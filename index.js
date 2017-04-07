require('./keep-alive');

var Botkit = require('botkit');
var GitHub = require("github");
var Jarvis = require('./jarvis');
var chalk = require('chalk');

var github = new GitHub({
    version: "3.0.0",
    debug: true,
    timeout: 2000,
    headers: {
        "user-agent": "gocodebot"
    }
});
github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_API_TOKEN
});

var controller = Botkit.slackbot();

controller.spawn({
  token: process.env.SLACK_BOT_TOKEN
}).startRTM(function(err){
  if (err) {
    throw new Error(err);
  }
});

controller.hears(['create team'], ['direct_message', 'direct_mention'], function(bot, message){

  bot.startConversation(message, function(err, convo) {

    convo.say('I can do that.');

    var jarvis = new Jarvis(github);

    jarvis.createTeam(convo, function(){
      jarvis.addTeamMembers(convo, function(){
        jarvis.createContent(convo, function(url){
          convo.say(`Ok, we’re all set. You have an invitation email waiting for you. You can also visit https://github.com/${process.env.GITHUB_ORGANIZATION} and click the "View Invitation" button at the top.`);
          convo.say(`After accepting your invitation you can get started at: https://github.com/${process.env.GITHUB_ORGANIZATION}/${jarvis.team.name}`);
          convo.next();
        });
      });
    });

  });

});

// controller.hears(['add (.*) to (.*)'], ['direct_message', 'direct_mention'], function(bot, message){
//
//   var jarvis = new Jarvis(github);
//
// })
