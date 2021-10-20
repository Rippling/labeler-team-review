const core = require('@actions/core');
const github = require('@actions/github');
const _ = require('lodash');

// Main method
async function run() {
  try {
    const ipTeam = core.getInput('team', { required: true });
    const ipLabel = core.getInput('label', { required: true });
    const ipToken = core.getInput('repo-token', { required: true });
    const accessToken = core.getInput('access-token', { required: true });
    console.log(`>>> Event: ${github.context.eventName}`);
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
      await addLabels(client, prNumber, [ipLabel]);
      console.log('>>> Success');
    }

  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
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

function getPrAuthor() {
  const pullRequest = github.context.payload.pull_request || github.context.payload.issue;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.user.login;

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
