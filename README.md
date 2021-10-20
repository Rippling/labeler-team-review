# Pull Request Team Review Labeler

Automatically label pull requests if member from configured team has reviewed the pull reuqest

## Setup

Install the dependencies

```bash
npm install
```

Run the tests :heavy_check_mark:

```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)
...
```

## Distribute

GitHub Actions will run the entry point from the action.yml. Packaging assembles the code into one file that can be checked in to Git, enabling fast and reliable execution and preventing the need to check in node_modules.

Actions are run from GitHub repos. Packaging the action will create a packaged action in the dist folder.

Run prepare

```bash
npm run prepare
```

Since the packaged index.js is run from the dist folder.

```bash
git add dist
```

## Create a release branch

Users shouldn't consume the action from master since that would be latest code and actions can break compatibility between major versions.

Checkin to the v1 release branch

```bash
git checkout -b v1
git commit -a -m "v1 release"
```

```bash
git push origin v1
```

Your action is now published! :rocket:

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Usage

You can now consume the action by referencing the v1 branch

```yaml
name: Team Review Labeler
on:
  pull_request_review:
    types: [submitted]
  issue_comment:
    types: [created]
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: Rippling/labeler-team-review@v1
        with:
          repo-token: "${{ secrets.GITHUB_TOKEN }}"
          access-token: <ADD ACCESS TOKENs>
          team: "frontend"
          label: "fe-reviewed"
```
