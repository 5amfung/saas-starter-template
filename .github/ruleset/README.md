# GitHub Rulesets

Apply the `Protect main` ruleset with:

```sh
gh api --method PUT \
  -H 'Accept: application/vnd.github+json' \
  repos/5amfung/saas-starter-template/rulesets/14349281 \
  --input .github/ruleset/protect-main-ruleset.json
```
