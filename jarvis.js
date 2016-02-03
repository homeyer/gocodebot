'use strict';

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
          convo.next();
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

    convo.say("I'm starting your team off with some tips in your README. Hang on a sec.");
    //TODO create repo
    //TODO assign repo to team
    //TODO create README with link to waffle board
    //TODO create issues

    var url = 'https://github.com/GoCodeColorado/organic-robots';

    callback(url);
    convo.next();
  }


}

module.exports = Jarvis;
