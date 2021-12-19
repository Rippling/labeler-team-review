const core = require('@actions/core');
const github = require('@actions/github');
const _ = require('lodash');
const axios = require("axios");

// Main method
async function run() {
  try {
    const ipTeam = core.getInput('team', { required: true });
    const ipLabel = core.getInput('label', { required: true });
    const ipToken = core.getInput('repo-token', { required: true });
    const accessToken = core.getInput('access-token', { required: true });
    
    console.log(`>>> Eventt: ${github.context.eventName}`);
    console.log(`>>> Team: ${ipTeam} / Label: ${ipLabel}`);

    if (!ipTeam || !ipLabel || !ipToken || !accessToken) {
      console.log('Err: Missing input, exiting');
      return;
    }

    const prNumber = getPrNumber();
    if (!prNumber) {
      console.log('>>> Err: Could not get pull request number from context, exiting');
      return;
    }
    console.log(`>>> PR/Issue Number: ${prNumber}`);

    const authorLogin = getPrAuthor();
    if (authorLogin) {
      console.log(`>>> PR Author: ${authorLogin}`);
    }

    const client = github.getOctokit(accessToken);
    const clientBot = github.getOctokit(ipToken);
    const teamMembers = await getTeamMembers(client, ipTeam);
    const currentReviewers = await getCurrentReviewers(client, prNumber);
    const currentComments = await getCurrentComments(client, prNumber)
    const allActioners = _.filter([...currentReviewers, ...currentComments], login => login !== authorLogin);
    const isTeamActionAvailable = _.some(allActioners, login => teamMembers.includes(login));

    console.log(`>>> Team`, teamMembers);
    console.log(`>>> Reviewers`, currentReviewers);
    console.log(`>>> Comments`, currentComments);
    console.log(`>>> All Valid Actioners`, allActioners);

    if (isTeamActionAvailable) {
      console.log('>>> Team has taken action');
      await addLabels(clientBot, prNumber, [ipLabel]);
      console.log('>>> Success');
    }

    await notifySlack()

  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

function getSlackChannelsToBeNotified(allSlackChannelList, prLabels) {
  let channelList = typeof allSlackChannelList === 'string' ? JSON.parse(allSlackChannelList) : allSlackChannelList;
  return (prLabels || []).reduce((acc, label) => {
    if (channelList[label.name]) {
      acc.push(channelList[label.name]);
      return acc;
    }
  }, []);
}

async function notifySlack() {
  const slackChannelJSON = core.getInput('slackchannellist', { required: true });
  const prLabels = getPrLabels();

  if (!slackChannelJSON) {
    console.log('Err: slackChannelJSON not found, exiting');
    return;
  }

  // Read slack channel json
  const slackChannelsToBeNotified = getSlackChannelsToBeNotified(slackChannelJSON, prLabels);
  console.log(`>>> Slack channels to be notified`, slackChannelsToBeNotified);

  if(!slackChannelsToBeNotified || slackChannelsToBeNotified.length === 0) {
    return;
  }

  const notificationPromise = slackChannelsToBeNotified.map(channel => {
    const payload = {
      channel,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `New pull request from ${getPrAuthor()}\n\n<${getPrUrl()}|View request>`
          }
        }
      ]
    };
    return axios.post("https://slack.com/api/chat.postMessage", payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": payload.length,
        Authorization: `Bearer ${core.getInput("slack-bearer-token")}`,
        Accept: "application/json",
      },
    });
  })

  Promise.all(notificationPromise)
    .then(() => console.log('>>> Notications sent'))
    .catch((error) => {
      console.error(error);
      core.setFailed(error.message);
    })
}

// Helper functions
async function addLabels(client, prNumber, labels) {
  await client.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    labels: labels,
  });
}

function getPrNumber() {
  const pullRequest = github.context.payload.pull_request || github.context.payload.issue;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.number;
}

function getPrUrl() {
  const pullRequest = github.context.payload.pull_request || github.context.payload.issue;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.html_url;
}

function getPrAuthor() {
  const pullRequest = github.context.payload.pull_request || github.context.payload.issue;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.user.login;

}

function getPrLabels() {
  const pullRequest = github.context.payload.pull_request || github.context.payload.issue;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.labels;

}

async function getTeamMembers(client, teamSlug) {
  const team = await client.rest.teams.listMembersInOrg({
    org: github.context.repo.owner,
    team_slug: teamSlug,
  });
  if (!team) {
    return [];
  }
  return _.map(team.data, 'login');
}

async function getCurrentComments(client, prNumber) {
  return client.rest.issues
    .listComments({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: prNumber,
    })
    .then(({ data: comments }) => {
      return _.uniq(_.map(comments, 'user.login'));
    });
}

async function getCurrentReviewers(client, prNumber) {
  return client.rest.pulls
    .listReviews({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber,
    })
    .then(({ data: reviews }) => {
      return _.uniq(_.map(reviews, 'user.login'));
    });
}


// Trigger
run();
