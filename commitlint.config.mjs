// Pull requests are checked against Conventional Commits so that the
// semantic-release job can derive the next version from the history.
//
// body-max-line-length is a warning rather than an error: commit a27ca27 is
// already on main with one long body line, and rewriting shared history to fix
// it isn't worth it. New commits should still keep body lines under 100.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', 100],
  },
}
