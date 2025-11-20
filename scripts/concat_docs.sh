#!/usr/bin/env bash

set -euo pipefail

# Root directory that contains the docs tree.
DOCS_DIR="docs"
# Allow overriding the output file via the first CLI argument.
OUTPUT_FILE="${1:-docs/all-docs.md}"

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "Directory '$DOCS_DIR' not found relative to $(pwd)" >&2
  exit 1
fi

# Ensure the destination directory exists and compute absolute paths that we can compare.
output_dir=$(dirname "$OUTPUT_FILE")
[[ "$output_dir" == "." ]] || mkdir -p "$output_dir"
output_abs=$(cd "$output_dir" && pwd)/$(basename "$OUTPUT_FILE")
docs_dir_abs=$(cd "$DOCS_DIR" && pwd)

# Gather an ordered list of every regular file under docs, excluding dotfiles.
doc_files=()
while IFS= read -r file; do
  doc_files+=("$file")
done < <(find "$docs_dir_abs" -type f ! -name ".*" -print | LC_ALL=C sort)

if [[ ${#doc_files[@]} -eq 0 ]]; then
  echo "No files found under $DOCS_DIR" >&2
  exit 1
fi

# Truncate the output file before writing.
: >"$output_abs"

for file in "${doc_files[@]}"; do
  # Skip the output file itself if it already lives under docs.
  if [[ "$file" == "$output_abs" ]]; then
    continue
  fi

  relative_path=${file#"$docs_dir_abs"/}
  {
    printf -- '---\n# %s\n\n' "$relative_path"
    cat "$file"
    printf -- '\n\n'
  } >>"$output_abs"
done

echo "Combined ${#doc_files[@]} files into $output_abs"
