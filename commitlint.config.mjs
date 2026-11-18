// Only the PR title is linted (squash merges use it as the commit message); there is no commit-msg hook.
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'test']],
  },
}

export default config
