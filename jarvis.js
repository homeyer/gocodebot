'use strict';
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');

class Jarvis {
  constructor(github){
    this.github = github;
    this.team = null;
  }

  createTeam(convo, callback) {
    var github = this.github;
    var me = this;

    convo.ask('What’s the team’s name?', [{
      pattern: /^[a-z0-9]+$/i,
      callback: function(response, convo) {

        github.repos.createFromOrg({
          name: response.text,
          org: process.env.GITHUB_ORGANIZATION
        }, function(err, data){
          if(err){
            convo.say(`Sorry, I can't do that: ${JSON.parse(err.message).errors[0].message}`);
            return convo.next();
          }

          me.teamName = response.text

          github.orgs.createTeam({
            org: process.env.GITHUB_ORGANIZATION,
            name: me.teamName,
            permission: 'push',
            repo_names: [`${process.env.GITHUB_ORGANIZATION}/${me.teamName}`]
          }, function(err, data){
            if(err){
              convo.say(`Sorry, I can't do that: ${JSON.parse(err.message).errors[0].message}`);
              return convo.next();
            }
            me.team = data;
            convo.say(`Great! I've created ${process.env.GITHUB_ORGANIZATION}/${me.teamName}.`);
            callback();
            convo.next();
          });
        });

      }
    },
    {
      default: true,
      callback: function(response, convo) {
        convo.say("I'm sorry, please only use letters and numbers.");
        me.createTeam(convo, callback);
        convo.next();
      }
    }])
  }


  addTeamMembers(convo, callback) {
    var github = this.github;
    var me = this;

    convo.ask('Who would you like to add to the team?', function(response, convo){

      var teamMembers = response.text.split(/[\s,]+/);
      var printableTeamMembers = teamMembers.splice(0, teamMembers.length-1).join(', ') + ' and ' + teamMembers[teamMembers.length-1];

      var userExistencePromises = teamMembers.map(function(member){
        return new Promise(function(resolve, reject){
          github.user.getFrom({
            user: member
          }, function(err, data){
            if(err){
              return reject(`Uh oh, we couldn't find ${member}. Let's try that again.`);
            }
            resolve(data);
          });
        });
      });

      Promise.all(userExistencePromises)
      .then(function(values){

        var addMembershipPromises = teamMembers.map(function(member){
          return new Promise(function(resolve, reject){
            github.orgs.addTeamMembership({
              id: me.team.id,
              user: member
            }, function(err, data){
              if(err){
                return reject(`Uh oh, we couldn't add ${member}.`);
              }
              resolve(data);
            });
          });
        });

        Promise.all(addMembershipPromises)
        .then(function(values){
          convo.say(`Great, I’ve invited ${printableTeamMembers} to join the team.`);
          callback();
        })
        .catch(function(reason){
          convo.say(reason);
          me.addTeamMembers();
          convo.next();
        })

      })
      .catch(function(reason){
        convo.say(reason);
        me.addTeamMembers();
        convo.next();
      })

    });
  }


  createContent(convo, callback) {
    console.log('in createContent');
    var me = this;

    convo.say("I'm starting your team off with some tips in your README. Hang on a sec.");

    me.createReadme(function(err){
      console.log(chalk.bgRed('done creating readme'), err);
      if(err){
        convo.say(err);
        return;
      }

      me.createLabels(function(err){
        console.log(chalk.bgRed('done creating labels'), err);
        if(err){
          convo.say(err);
          return;
        }

        setTimeout(function(){
          me.createIssues(function(err){
            console.log(chalk.bgRed('done creating issues'), err);
            if(err){
              convo.say(err);
              return;
            }

            var url = `https://github.com/${process.env.GITHUB_ORGANIZATION}/${me.team.name}`;

            callback(url);

          });
        }, 1000);

      })

    });

  }

  createReadme(callback) {
    var me = this;
    var github = this.github;

    fs.readFile(path.join(__dirname, 'content', 'README-template.md'), function(err, data){
      if(err){
          return callback(err);
      }

      var readme = data.toString();
      readme = readme.replace(/:owner/g, process.env.GITHUB_ORGANIZATION);
      readme = readme.replace(/:repo/g, me.team.name);

      var base64 = new Buffer(readme).toString('base64');

      github.repos.createFile({
        user: process.env.GITHUB_ORGANIZATION,
        repo: me.team.name,
        path: 'README.md',
        message: 'GoCodeBot was here',
        content: base64

      }, function(err, data){
        if(err){
          return callback(err);
        }
        callback(null);
      });
    });
  }


  createLabels(callback) {
    var me = this;
    var github = this.github;

    var labels = [
      {name: 'blocked', color: 'e11d21'},
      {name: 'validated', color: '5319e7'},
      {name: 'invalidated', color: 'fbca04'},
      {name: 'design needed', color: 'eb6420'},
      {name: 'dev needed', color: 'bfd4f2'},
      {name: 'sprint 1', color: 'ddd1e7'},
      {name: 'sprint 2', color: 'bba3d0'},
      {name: 'sprint 3', color: '9975b9'},
      {name: 'sprint 4', color: '7647a2'},
      {name: 'sprint 5', color: '551a8b'}
    ];

    var promises = labels.map(function(label){
      return new Promise(function(resolve, reject){
        github.issues.createLabel({
          user: process.env.GITHUB_ORGANIZATION,
          repo: me.team.name,
          name: label.name,
          color: label.color
        }, function(err, data){
          if(err){
            return reject(err);
          }
          resolve(data);
        })
      })
    });

    Promise.all(promises)
    .then(function(){
      callback();
    })
    .catch(function(err){
      callback(err);
    });
  }


  createIssues(callback) {
    var me = this;
    var github = this.github;

    fs.readFile(path.join(__dirname, 'content', 'cards.json'), 'utf8', function(err, data){
      if(err){
        return next(err);
      }

      var cardsMetadata = JSON.parse(data);

      var cards = cardsMetadata.map(function(metadata){
        return {
          title: metadata.title,
          // labels: metadata.labels,
          description: fs.readFileSync(path.join(__dirname, 'content', 'cards', metadata.file), 'utf8')
        }
      });

      var promises = cards.map(function(card){
        return new Promise(function(resolve, reject){
          github.issues.create({
            user: process.env.GITHUB_ORGANIZATION,
            repo: me.team.name,
            title: card.title,
            labels: card.labels,
            body: card.description
          }, function(err, data){
            if(err){
              return reject(err);
            }
            resolve(data);
          })
        })
      })

      Promise.all(promises)
      .then(function(){
        callback();
      })
      .catch(function(err){
        callback(err);
      })
  });
  }


}

module.exports = Jarvis;
