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
          org: process.env.GITHUB_ORGANIZATION,
          private: true
        }, function(err, data){
          if(err){
            convo.say(`Sorry, I can't do that: ${JSON.parse(err.message).errors[0].message}`);
            return convo.next();
          }

          me.teamName = response.text

          github.orgs.createTeam({
            org: process.env.GITHUB_ORGANIZATION,
            name: me.teamName,
            permission: 'admin',
            repo_names: [`${process.env.GITHUB_ORGANIZATION}/${me.teamName}`]
          }, function(err, data){
            if(err){
              convo.say(`Sorry, I can't do that: ${JSON.parse(err.message).errors[0].message}`);
              return convo.next();
            }
            me.team = data;
            convo.say(`Great! I've created ${me.teamName} in ${process.env.GITHUB_ORGANIZATION}.`);
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

    convo.ask('Who would you like to add to the team? (Comma-separated list of GitHub usernames)', function(response, convo){

      var teamMembers = response.text.split(/[\s,]+/);
      var printableTeamMembers = teamMembers.slice(0, teamMembers.length-1).join(', ') + ' and ' + teamMembers[teamMembers.length-1];

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

        var sequence = Promise.resolve();
        teamMembers.forEach(function(member){
          sequence = sequence.then(function(){
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
        });

        sequence.then(function(values){
          convo.say(`Great, I’ve invited ${printableTeamMembers} to join the team.`);
          callback();
        })

      })
      .catch(function(reason){
        convo.say(reason);
        me.addTeamMembers(convo, callback);
        convo.next();
      })

    });
  }


  createContent(convo, callback) {
    var me = this;

    convo.say("I'm starting your team off with some tips in your README. Hang on a sec.");

    me.createReadme()
    .then(function(){
      return me.createLabels();
    })
    .then(function(){
      // we get errors if we don't wait a moment after creating labels
      return new Promise(function(resolve, reject){
        setTimeout(function(){
          resolve();
        }, 1000);
      });
    })
    .then(function(){
      return me.createIssues();
    })
    .then(function(){
      callback();
    })
    .catch(function(reason){
      convo.say(reason);
    })

  }

  createReadme() {
    var me = this;
    var github = this.github;

    return new Promise(function(resolve, reject){

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
            return reject(err);
          }
          resolve();
        });
      });
    });
  }


  createLabels() {
    var me = this;
    var github = this.github;

    var labels = [
      {name: 'blocked', color: 'e11d21'},
      {name: 'validated', color: '5319e7'},
      {name: 'invalidated', color: 'fbca04'},
      {name: 'design needed', color: 'eb6420'},
      {name: 'dev needed', color: 'bfd4f2'},
      {name: 'sprint 1', color: '91aab3'},
      {name: 'sprint 2', color: '235668'},
      {name: 'sprint 3', color: 'f7b5b2'},
      {name: 'sprint 4', color: '91aab3'},
      {name: 'sprint 5', color: 'f7b5b2'}
    ];

    var sequence = Promise.resolve();
    labels.forEach(function(label){
      sequence = sequence.then(function(){
        new Promise(function(resolve, reject){
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
        });
      })
    });

    return sequence;
  }


  createIssues() {
    var me = this;
    var github = this.github;

    return new Promise(function(resolve, reject){

      fs.readFile(path.join(__dirname, 'content', 'cards.json'), 'utf8', function(err, data){
        if(err){
          return reject(err);
        }

        var cardsMetadata = JSON.parse(data);

        var cards = cardsMetadata.map(function(metadata){
          return {
            title: metadata.title,
            labels: metadata.labels,
            description: fs.readFileSync(path.join(__dirname, 'content', 'cards', metadata.file), 'utf8')
          }
        });

        var sequence = Promise.resolve();
        cards.forEach(function(card){
          sequence = sequence.then(function(){

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
              });
            });
          });
        });

        sequence.then(function(){
          resolve();
        }).catch(function(err){
          reject(err);
        })
      });
    });
  }


}

module.exports = Jarvis;
