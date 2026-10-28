// Pull requests are checked against Conventional Commits so that the
// semantic-release job can derive the next version from the history.
export default {
  extends: ['@commitlint/config-conventional'],
}
