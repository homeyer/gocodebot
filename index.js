var Botkit = require('Botkit');
require('./keep-alive');

var controller = Botkit.slackbot();

controller.spawn({
  token: process.env.SLACK_BOT_TOKEN
}).startRTM(function(err){
  if (err) {
    throw new Error(err);
  }
});

controller.hears(['create team'],['direct_message','direct_mention'], function(bot, message){

  // start a conversation to handle this response.
  bot.startConversation(message, function(err,convo) {

    convo.ask('I can do that. What’s the team’s name?', function(response, convo){

      var teamName = response.text;
      // TODO create team

      convo.ask('Who would you like to add to the team?', function(response, convo){

        var teamMembers = response.text.split(/[\s,]+/);
        var printableTeamMembers = teamMembers.splice(0, teamMembers.length-1).join(', ') + ' and ' + teamMembers[teamMembers.length-1];

        //TODO check existance of each team mate
        //TODO add member to team

        convo.say(`Great, I’ve created team ${teamName} and invited ${printableTeamMembers} to join it. I’m setting up the project for them now.`)

        //TODO create repo
        //TODO assign repo to team
        //TODO create README with link to waffle board
        //TODO create issues

        var url = 'https://github.com/GoCodeColorado/organic-robots';

        convo.say(`Ok, we’re all set. The team can get started at ${url}`);

        convo.next();
      });

      convo.next();
    });


  });

});
