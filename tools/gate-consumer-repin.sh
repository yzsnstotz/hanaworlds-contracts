#!/usr/bin/env bash
# Consumer re-pin fixture (C-CONTRACTS-CONVERGE-01): run a delivered consumer's own scripts at its
# exact commit twice, read-only from a bare clone: once with its original contracts pin (baseline)
# and once with only the contracts package swapped for the candidate tar. Never writes the
# consumer's repository. A script failing only in the candidate phase is a re-pin/adaptation signal.
#   gate-consumer-repin.sh <bare-git-dir> <commit> <dep|vendor:<dir>[,...]> <candidate.tgz> <evidence-dir> <script>...
set -uo pipefail
repo=${1:?bare git dir}; commit=${2:?commit}; mode=${3:?dep|vendor:<dir>}; tar_new=${4:?candidate tgz}; evidence_dir=${5:?evidence dir}; shift 5
[[ "$evidence_dir" = /* && "$tar_new" = /* && $# -gt 0 ]] || { echo 'usage error' >&2; exit 2; }
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
rm -rf "$evidence_dir"; mkdir -p "$evidence_dir"
build_dir=$(mktemp -d "${evidence_dir%/*}/repin.XXXXXX")
export npm_config_cache="$build_dir/npm-cache"
trap 'rm -rf "$build_dir"' EXIT
full=$(git -C "$repo" rev-parse --verify "$commit^{commit}") || exit 2
printf '%s\n' "$full" > "$evidence_dir/consumer-commit.txt"
shasum -a 256 "$tar_new" > "$evidence_dir/candidate-tar.sha256"
summary="$evidence_dir/summary.tsv"; printf 'phase\tscript\texit\n' > "$summary"
for phase in baseline candidate; do
  dir="$build_dir/$phase"; mkdir "$dir"; git -C "$repo" archive "$full" | tar -x -C "$dir"
  (cd "$dir" && npm ci --ignore-scripts --no-audit --no-fund) > "$evidence_dir/$phase-npm-ci.log" 2>&1
  printf 'npm-ci\t%s\n' "$?" >> "$evidence_dir/$phase-npm-ci.log"
  : > "$evidence_dir/$phase-contracts-version.txt"
  IFS=, read -ra targets <<< "$mode"
  for m in "${targets[@]}"; do
    case "$m" in
      dep) target="$dir/node_modules/hanaworlds-contracts";;
      vendor:*) target="$dir/${m#vendor:}";;
      *) echo "bad mode $m" >&2; exit 2;;
    esac
    if [[ $phase = candidate ]]; then rm -rf "$target"; mkdir -p "$target"; tar -xzf "$tar_new" --strip-components=1 -C "$target"; fi
    printf '%s\t%s\n' "$m" "$(node -e "console.log(require(process.argv[1]).version)" "$target/package.json" 2>&1)" >> "$evidence_dir/$phase-contracts-version.txt"
  done
  for s in "$@"; do
    (cd "$dir" && npm run -s "$s") > "$evidence_dir/$phase-${s//[:\/]/_}.log" 2>&1
    printf '%s\t%s\t%s\n' "$phase" "$s" "$?" >> "$summary"
  done
done
cat "$summary"
