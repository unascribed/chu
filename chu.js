var restify = require('restify');
var irc = require('irc');
var request = require('request');
var util = require('util');
var config = require('./config.json');

var client = new irc.Client(config.irc.server, config.irc.nick, config.irc);
client.addListener('error', console.error);

var server = restify.createServer();

server.use(restify.queryParser());
server.use(restify.bodyParser());

server.post(config.http.path, (req, res, next) => {
	var channel = '#'+(req.query.channel || config.irc.homeChannel);
	var event = req.header('X-GitHub-Event');
	var action = req.body.action;
	var repo = req.body.repository ? req.body.repository.full_name : null;
	var sender = req.body.sender.login;
	if (event === 'issues') {
		var issue = req.body.issue;
		if (action === 'opened') {
			msg(channel, repo, 'Issue #'+issue.number+' \x0309\x02opened\x0f by '+sender, issue.title, issue.html_url);
		} else if (action === 'closed') {
			msg(channel, repo, 'Issue #'+issue.number+' \x0304\x02closed\x0f by '+sender, issue.title, issue.html_url);
		} else if (action === 'reopened') {
			msg(channel, repo, 'Issue #'+issue.number+' \x0308\x02reopened\x0f by '+sender, issue.title, issue.html_url);
		}
	} else if (event === 'pull_request') {
		var pr = req.body.pull_request;
		if (action === 'opened') {
			msg(channel, repo, 'Pull #'+pr.number+' \x0309\x02opened\x0f by '+sender, pr.title, pr.html_url);
		} else if (action === 'closed') {
			if (req.body.pull_request.merged) {
				msg(channel, repo, 'Pull #'+pr.number+' \x0313\x02merged\x0f by '+sender, pr.title, pr.html_url);
			} else {
				msg(channel, repo, 'Pull #'+pr.number+' \x0304\x02closed\x0f by '+sender, pr.title, pr.html_url);
			}
		} else if (action === 'reopened') {
			msg(channel, repo, 'Pull #'+pr.number+' \x0308\x02reopened\x0f by '+sender, pr.title, pr.html_url);
		}
	} else if (event === 'push') {
		var branch = req.body.ref.slice(11)+'/';
		if (branch === req.body.repository.default_branch) branch = '';
		req.body.commits.forEach((commit) => {
			msg(channel, repo, 'New commit \x02'+branch+commit.id.slice(0, 8)+'\x0f by '+sender, commit.message.split('\n')[0], commit.url); 
		});
	} else if (event === 'repository') {
		if (action === 'created') {
			msg(channel, repo, 'Repository \x0309\x02created\x0f by '+sender, req.body.repository.description, req.body.repository.html_url);
		} else if (action === 'deleted') {
			msg(channel, repo, 'Repository \x0304\x02deleted\x0f by '+sender, '', null);
		}
	} else if (event === 'organization') {
		var org = req.body.organization.login;
		if (action === 'member_added') {
			msg(channel, org, req.body.membership.user.login+' \x0304\x02joined\x0f', '', null);
		} else if (action === 'member_removed') {
			msg(channel, org, req.body.membership.user.login+' \x0304\x02left\x0f', '', null);
		} else if (action === 'member_invited') {
			msg(channel, org, req.body.invitation.login+' \x0313\x02invited\x0f by '+sender, '', null);
		}
	} else if (event === "ping") {
		msg(channel, req.body.hook.type === "Repository" ? req.body.repository.full_name : req.body.organization.login+'/*', 'Bot connected by '+sender, req.body.zen, null);
		if (channel !== '#'+config.irc.homeChannel) {
			msg('#'+config.irc.homeChannel, req.body.hook.type === "Repository" ? req.body.repository.full_name : req.body.organization.login+'/*', 'Bot connected to '+channel+' by '+sender, req.body.zen, null);
		}
	} else if (event === "gollum") {
		req.body.pages.forEach((page) => {
			if (page.action === "created") {
				msg(channel, repo, 'Wiki page \x0309\x02created\x0f by '+sender, page.title, page.html_url); 
			} else if (page.action === "edited") {
				msg(channel, repo, 'Wiki page \x0308\x02modified\x0f by '+sender, page.title, page.html_url); 
			}
		});
	} else if (event === "release") {
		msg(channel, repo, 'Release \x0309\x02published\x0f by '+sender, req.body.release.name || req.body.release.tag_name, req.body.release.html_url); 
	} else if (event === "create") {
		if (req.body.ref_type === "branch") {
			var ref = req.body.ref.replace("refs/heads/", "");
			msg(channel, repo, 'Branch \x0309\x02created\x0f by '+sender, ref, req.body.repository.html_url+"/tree/"+ref); 
		}
	} else if (event === "delete") {
		if (req.body.ref_type === "branch") {
			var ref = req.body.ref.replace("refs/heads/", "");
			msg(channel, repo, 'Branch \x0304\x02deleted\x0f by '+sender, ref, req.body.repository.html_url+"/tree/"+ref); 
		}
	}
	res.send(200, 'OK');
});

server.listen(config.http.port, config.http.bind);

function msg(channel, repo, msg, desc, url) {
	console.log('[%s] %s: %s %s', repo, msg, desc, url);
	if (url != null) {
		request.post('https://git.io/create', {
			form:{url:url}
		}, (err, res, body) => {
			client.say(channel, util.format(config.messageFormat, repo, msg, desc, body ? 'https://git.io/'+body : url));
		});
	} else {
		client.say(channel, util.format(config.messageFormat, repo, msg, desc, ''));
	}
}
