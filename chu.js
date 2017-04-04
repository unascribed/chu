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
	var org = req.body.organization ? req.body.organization.login : null;
	var sender = req.body.sender.login;
	if (event === 'issues') {
		var issue = req.body.issue;
		if (action === 'opened') {
			msg(channel, repo, 'Issue #'+issue.number+' §a§lopened§r by '+sender, issue.title, issue.html_url);
		} else if (action === 'closed') {
			msg(channel, repo, 'Issue #'+issue.number+' §c§lclosed§r by '+sender, issue.title, issue.html_url);
		} else if (action === 'reopened') {
			msg(channel, repo, 'Issue #'+issue.number+' §e§lreopened§r by '+sender, issue.title, issue.html_url);
		}
	} else if (event === 'pull_request') {
		var pr = req.body.pull_request;
		if (action === 'opened') {
			msg(channel, repo, 'Pull #'+pr.number+' §a§lopened§r by '+sender, pr.title, pr.html_url);
		} else if (action === 'closed') {
			if (req.body.pull_request.merged) {
				msg(channel, repo, 'Pull #'+pr.number+' §d§lmerged§r by '+sender, pr.title, pr.html_url);
			} else {
				msg(channel, repo, 'Pull #'+pr.number+' §c§lclosed§r by '+sender, pr.title, pr.html_url);
			}
		} else if (action === 'reopened') {
			msg(channel, repo, 'Pull #'+pr.number+' §e§lreopened§r by '+sender, pr.title, pr.html_url);
		}
	} else if (event === 'push') {
		var branch = req.body.ref.slice(11)+'/';
		if (branch === req.body.repository.default_branch) branch = '';
		req.body.commits.forEach((commit) => {
			msg(channel, repo, 'Commit §a§lpushed§r by '+sender, '§l'+branch+commit.id.slice(0, 8)+'§r '+commit.message.split('\n')[0], commit.url); 
		});
	} else if (event === 'repository') {
		if (action === 'created') {
			msg(channel, repo, 'Repository §a§lcreated§r by '+sender, req.body.repository.description, req.body.repository.html_url);
		} else if (action === 'deleted') {
			msg(channel, repo, 'Repository §c§ldeleted§r by '+sender, '', null);
		}
	} else if (event === 'organization') {
		if (action === 'member_added') {
			msg(channel, org, req.body.membership.user.login+' §c§ljoined§r', '', null);
		} else if (action === 'member_removed') {
			msg(channel, org, req.body.membership.user.login+' §c§lleft§r', '', null);
		} else if (action === 'member_invited') {
			msg(channel, org, req.body.invitation.login+' §d§linvited§r by '+sender, '', null);
		}
	} else if (event === "ping") {
		msg(channel, req.body.hook.type === "Repository" ? req.body.repository.full_name : req.body.organization.login+'/*', 'Bot connected by '+sender, req.body.zen, null);
		if (channel !== '#'+config.irc.homeChannel) {
			msg('#'+config.irc.homeChannel, req.body.hook.type === "Repository" ? req.body.repository.full_name : req.body.organization.login+'/*', 'Bot connected to '+channel+' by '+sender, req.body.zen, null);
		}
	} else if (event === "gollum") {
		req.body.pages.forEach((page) => {
			if (page.action === "created") {
				msg(channel, repo, 'Wiki page §a§lcreated§r by '+sender, page.title, page.html_url); 
			} else if (page.action === "edited") {
				msg(channel, repo, 'Wiki page §e§lmodified§r by '+sender, page.title, page.html_url); 
			}
		});
	} else if (event === "release") {
		msg(channel, repo, 'Release §a§lpublished§r by '+sender, req.body.release.name || req.body.release.tag_name, req.body.release.html_url); 
	} else if (event === "create") {
		if (req.body.ref_type === "branch") {
			var ref = req.body.ref.replace("refs/heads/", "");
			msg(channel, repo, 'Branch §a§lcreated§r by '+sender, ref, req.body.repository.html_url+"/tree/"+ref); 
		}
	} else if (event === "delete") {
		if (req.body.ref_type === "branch") {
			var ref = req.body.ref.replace("refs/heads/", "");
			msg(channel, repo, 'Branch §c§ldeleted§r by '+sender, ref, req.body.repository.html_url+"/tree/"+ref); 
		}
	} else if (event === "team") {
		if (action === "created") {
			msg(channel, org, 'Team §a§lcreated§r by '+sender, req.body.team.name, null); 
		} else if (action === "deleted") {
			msg(channel, org, 'Team §c§ldeleted§r by '+sender, req.body.team.name, null); 
		} else if (action === "edited") {
			msg(channel, org, 'Team §e§ledited§r by '+sender, req.body.team.name, null); 
		} else if (action === "added_to_repository") {
			msg(channel, repo, 'Team §a§ladded§r to repository by '+sender, req.body.team.name, null); 
		} else if (action === "removed_from_repository") {
			msg(channel, repo, 'Team §c§lremoved§r from repository by '+sender, req.body.team.name, null); 
		}
	} else if (event === 'issue_comment') {
		var issue = req.body.issue;
		var comment = req.body.comment;
		if (action === 'created') {
			msg(channel, repo, 'Comment on issue #'+issue.number+' §a§lposted§r by '+sender, issue.title, comment.html_url);
		} else if (action === 'deleted') {
			msg(channel, repo, 'Comment on issue #'+issue.number+' §c§ldeleted§r by '+sender, issue.title, comment.html_url);
		} else if (action === 'edited') {
			msg(channel, repo, 'Comment on issue #'+issue.number+' §e§ledited§r by '+sender, issue.title, comment.html_url);
		}
	}
	res.send(200, 'OK');
});

server.listen(config.http.port, config.http.bind);

// I've spent WAY too much time manually writing Minecraft color codes, so this
// is actually /easier/ for me than some utility methods that take names
var mcCodes = {
	"§0": "\x0301", // black
	"§1": "\x0302", // navy
	"§2": "\x0303", // green
	"§3": "\x0310", // teal
	"§4": "\x0305", // maroon
	"§5": "\x0306", // purple
	"§6": "\x0307", // olive
	"§7": "\x0315", // silver
	"§8": "\x0314", // grey
	"§9": "\x0312", // blue
	"§a": "\x0309", // green
	"§b": "\x0311", // cyan
	"§c": "\x0304", // red
	"§d": "\x0313", // pink
	"§e": "\x0308", // yellow
	"§f": "\x0300", // white
	
	"§l": "\x02", // bold
	"§o": "\x1D", // italic
	"§m": "",     // strike, no IRC equivalent
	"§n": "\x1F", // underline
	"§r": "\x0F", // reset
}

function msg(channel, repo, msg, desc, url) {
	console.log('[%s] %s: %s %s', repo, msg, desc, url);
	if (url != null) {
		request.post('https://git.io/create', {
			form:{url:url}
		}, (err, res, body) => {
			client.say(channel, substituteColors(util.format(config.messageFormat, repo, msg, desc, err || (!res || res.statusCode != 200) ? url : 'https://git.io/'+body)));
		});
	} else {
		client.say(channel, substituteColors(util.format(config.messageFormat, repo, msg, desc, '')));
	}
}

function substituteColors(str) {
	Object.keys(mcCodes).forEach((k) => {
		str = str.replace(new RegExp(k, "gi"), mcCodes[k]);
	});
	return str;
}

