#!/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║        Smart Auto Commit Splitter  v3                   ║
# ║  Extension-aware · Path-semantic · Frontend + Backend   ║
# ╠══════════════════════════════════════════════════════════╣
# ║  Usage:   ./auto_commit_split.sh <num_commits>          ║
# ║  Example: ./auto_commit_split.sh 40                     ║
# ╚══════════════════════════════════════════════════════════╝

if [ -z "$1" ]; then
  echo "❌  Usage: ./auto_commit_split.sh <num_commits>"
  exit 1
fi

NUM_COMMITS=$1
FILES=($(git ls-files --modified --others --exclude-standard))
TOTAL_FILES=${#FILES[@]}

if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "✅  Nothing to commit — working tree is clean."
  exit 0
fi

[ "$TOTAL_FILES" -lt "$NUM_COMMITS" ] && NUM_COMMITS=$TOTAL_FILES
echo "📦  $TOTAL_FILES files detected → planning up to $NUM_COMMITS commits"
echo ""

# ══════════════════════════════════════════════════════════
#  EXTENSION → LANGUAGE / DOMAIN / COMMIT-TYPE HINTS
#
#  Returns a pipe-separated triplet:  lang|domain|type_hint
#  lang       → human label used in commit messages
#  domain     → logical layer (ui, api, db, infra, ...)
#  type_hint  → suggested conventional commit type
# ══════════════════════════════════════════════════════════
classify_extension() {
  local f="$1"
  local ext="${f##*.}"
  local base; base="$(basename "$f")"

  # ── Dependency / lock files (highest priority — check filename first) ──
  case "$base" in
    package.json|package-lock.json|yarn.lock|pnpm-lock.yaml| \
    bun.lockb|shrinkwrap.json)
      echo "js-deps|deps|chore"; return ;;
    requirements*.txt|Pipfile|Pipfile.lock|poetry.lock|setup.py|setup.cfg| \
    pyproject.toml)
      echo "py-deps|deps|chore"; return ;;
    go.sum|go.mod)                          echo "go-deps|deps|chore";   return ;;
    Gemfile|Gemfile.lock)                   echo "rb-deps|deps|chore";   return ;;
    Cargo.toml|Cargo.lock)                  echo "rust-deps|deps|chore"; return ;;
    composer.json|composer.lock)            echo "php-deps|deps|chore";  return ;;
    Dockerfile|docker-compose*.yml| \
    docker-compose*.yaml)                   echo "docker|infra|ci";      return ;;
    Makefile|makefile)                      echo "make|infra|chore";     return ;;
    Procfile)                               echo "heroku|infra|ci";      return ;;
    nginx.conf|*.nginx|.htaccess)           echo "server-config|infra|ci"; return ;;
    jest.config.*|vitest.config.*| \
    karma.conf.*)                           echo "test-config|test|config"; return ;;
    babel.config.*|.babelrc*)               echo "babel|tooling|config"; return ;;
    tsconfig*.json|jsconfig*.json)          echo "ts-config|tooling|config"; return ;;
    webpack.config.*|vite.config.*| \
    rollup.config.*|esbuild.config.*)       echo "bundler|tooling|config"; return ;;
    tailwind.config.*|postcss.config.*)     echo "css-config|styles|config"; return ;;
    next.config.*|nuxt.config.*| \
    astro.config.*|svelte.config.*)         echo "framework-config|app|config"; return ;;
    .eslintrc*|.eslintignore| \
    .prettierrc*|.stylelintrc*)             echo "linter|tooling|config"; return ;;
    .env|.env.*|*.env)                      echo "env|config|config";    return ;;
    .gitignore|.gitattributes| \
    .editorconfig)                          echo "git-config|tooling|chore"; return ;;
    *.test.ts|*.test.tsx|*.test.js| \
    *.test.jsx|*.spec.ts|*.spec.tsx| \
    *.spec.js|*.spec.jsx)                   echo "test|test|test";       return ;;
    *.d.ts)                                 echo "typescript|types|types"; return ;;
  esac

  # ── Extension-based classification ──
  case "$ext" in
    # ── TypeScript / JavaScript family ──────────────────
    tsx)        echo "react|ui|feat"        ;;
    jsx)        echo "react|ui|feat"        ;;
    ts)         echo "typescript|logic|feat" ;;
    js)         echo "javascript|logic|feat" ;;
    mjs)        echo "esmodule|logic|chore" ;;
    cjs)        echo "commonjs|logic|chore" ;;
    # ── Frontend frameworks ──────────────────────────────
    svelte)     echo "svelte|ui|feat"       ;;
    vue)        echo "vue|ui|feat"          ;;
    astro)      echo "astro|ui|feat"        ;;
    # ── Styles ───────────────────────────────────────────
    css)        echo "css|styles|style"     ;;
    scss|sass)  echo "scss|styles|style"    ;;
    less)       echo "less|styles|style"    ;;
    styl)       echo "stylus|styles|style"  ;;
    # ── Markup / Content ─────────────────────────────────
    mdx)        echo "mdx|content|docs"     ;;
    md)         echo "markdown|docs|docs"   ;;
    txt)        echo "text|docs|docs"       ;;
    html|htm)   echo "html|ui|feat"         ;;
    # ── Data / Config formats ────────────────────────────
    json)       echo "json|config|config"   ;;
    yaml|yml)   echo "yaml|config|config"   ;;
    toml)       echo "toml|config|config"   ;;
    ini|cfg|conf) echo "config|config|config" ;;
    xml)        echo "xml|config|config"    ;;
    # ── Python ───────────────────────────────────────────
    py)         echo "python|logic|feat"    ;;
    pyi)        echo "python|types|types"   ;;
    ipynb)      echo "notebook|data|feat"   ;;
    # ── Data / Science ───────────────────────────────────
    csv|tsv)    echo "data|data|chore"      ;;
    parquet|arrow|avro) echo "data|data|chore" ;;
    # ── Database / Query ─────────────────────────────────
    sql)        echo "sql|db|feat"          ;;
    prisma)     echo "prisma|db|feat"       ;;
    # ── GraphQL / API schemas ────────────────────────────
    graphql|gql) echo "graphql|api|feat"   ;;
    proto)      echo "protobuf|api|feat"    ;;
    # ── Shell / Scripting ────────────────────────────────
    sh|bash|zsh) echo "shell|scripts|chore" ;;
    ps1)        echo "powershell|scripts|chore" ;;
    # ── Backend languages ────────────────────────────────
    go)         echo "go|logic|feat"        ;;
    rb)         echo "ruby|logic|feat"      ;;
    rs)         echo "rust|logic|feat"      ;;
    java)       echo "java|logic|feat"      ;;
    kt)         echo "kotlin|logic|feat"    ;;
    php)        echo "php|logic|feat"       ;;
    cs)         echo "csharp|logic|feat"    ;;
    cpp|cc|cxx) echo "cpp|logic|feat"       ;;
    c)          echo "c|logic|feat"         ;;
    # ── Infrastructure ───────────────────────────────────
    tf|tfvars)  echo "terraform|infra|ci"   ;;
    k8s|helm)   echo "k8s|infra|ci"         ;;
    # ── Media / Static ───────────────────────────────────
    png|jpg|jpeg|gif|webp|svg|ico|avif)
                echo "image|assets|chore"   ;;
    woff|woff2|ttf|otf|eot)
                echo "font|assets|chore"    ;;
    # ── Fallback ─────────────────────────────────────────
    *)          echo "file|misc|refactor"   ;;
  esac
}

# ══════════════════════════════════════════════════════════
#  PATH SEGMENT → SEMANTIC SCOPE
#
#  Walks each path segment and maps it to a known domain.
#  Stops at the first recognised segment so the scope is
#  always the most specific meaningful layer.
# ══════════════════════════════════════════════════════════

# Map of known path segment → canonical scope name
declare -A SEGMENT_SCOPE=(
  # ── Frontend / UI layers ──────────────────────────────
  [components]="components"   [component]="components"
  [pages]="pages"             [page]="pages"
  [views]="views"             [view]="views"
  [layouts]="layouts"         [layout]="layouts"
  [screens]="screens"         [screen]="screens"
  [containers]="containers"   [container]="containers"
  [templates]="templates"     [template]="templates"
  [ui]="ui"                   [widgets]="widgets"
  [icons]="icons"             [icon]="icons"
  # ── Logic / Shared utilities ──────────────────────────
  [utils]="utils"             [util]="utils"
  [helpers]="helpers"         [helper]="helpers"
  [lib]="lib"                 [libs]="lib"
  [common]="common"           [shared]="shared"
  [core]="core"
  [constants]="constants"     [constant]="constants"
  [enums]="constants"         [enum]="constants"
  # ── State / Data flow ─────────────────────────────────
  [store]="store"             [stores]="store"
  [redux]="store"             [state]="store"
  [reducers]="store"          [reducer]="store"
  [actions]="store"           [action]="store"
  [slices]="store"            [slice]="store"
  [selectors]="store"
  [context]="context"         [contexts]="context"
  [providers]="context"       [provider]="context"
  [atoms]="store"             [signals]="store"
  # ── React / Framework primitives ──────────────────────
  [hooks]="hooks"             [hook]="hooks"
  [composables]="hooks"       [composable]="hooks"
  [directives]="hooks"
  [hoc]="hooks"
  # ── Backend / API layers ───────────────────────────────
  [api]="api"                 [apis]="api"
  [routes]="routes"           [route]="routes"
  [router]="routes"           [routers]="routes"
  [controllers]="controllers" [controller]="controllers"
  [handlers]="handlers"       [handler]="handlers"
  [resolvers]="resolvers"     [resolver]="resolvers"
  [services]="services"       [service]="services"
  [repositories]="repositories" [repository]="repositories"
  [usecases]="usecases"       [usecase]="usecases"
  [interactors]="usecases"
  [middleware]="middleware"   [middlewares]="middleware"
  [guards]="guards"           [guard]="guards"
  [policies]="guards"
  [validators]="validators"   [validator]="validators"
  [serializers]="serializers" [serializer]="serializers"
  [dto]="dto"                 [dtos]="dto"
  # ── Data / Database ────────────────────────────────────
  [models]="models"           [model]="models"
  [schemas]="schemas"         [schema]="schemas"
  [entities]="models"         [entity]="models"
  [migrations]="migrations"   [migration]="migrations"
  [seeds]="seeds"             [seeders]="seeds"
  [database]="db"             [db]="db"
  [prisma]="db"               [knex]="db"
  # ── Auth / Security ────────────────────────────────────
  [auth]="auth"               [authentication]="auth"
  [authorization]="auth"      [oauth]="auth"
  [jwt]="auth"                [session]="auth"
  [crypto]="security"         [encryption]="security"
  # ── Infrastructure / Config ────────────────────────────
  [config]="config"           [configs]="config"
  [configuration]="config"    [settings]="config"
  [env]="config"
  [infra]="infra"             [infrastructure]="infra"
  [terraform]="infra"         [k8s]="infra"
  [kubernetes]="infra"        [helm]="infra"
  [docker]="infra"
  [ci]="ci"                   [cd]="ci"
  [scripts]="scripts"         [script]="scripts"
  [bin]="scripts"             [tools]="scripts"
  # ── Async / Background ────────────────────────────────
  [workers]="workers"         [worker]="workers"
  [jobs]="workers"            [job]="workers"
  [queues]="workers"          [queue]="workers"
  [tasks]="workers"           [task]="workers"
  [cron]="workers"
  [events]="events"           [event]="events"
  [listeners]="events"        [listener]="events"
  [subscribers]="events"      [emitters]="events"
  # ── Communication / External ──────────────────────────
  [email]="email"             [mail]="email"
  [mailer]="email"            [notifications]="notifications"
  [webhooks]="webhooks"       [webhook]="webhooks"
  [sockets]="sockets"         [socket]="sockets"
  [websockets]="sockets"
  # ── Documentation / Content ───────────────────────────
  [docs]="docs"               [doc]="docs"
  [documentation]="docs"      [content]="content"
  [blog]="content"            [posts]="content"
  [mdx]="content"
  # ── Styles ────────────────────────────────────────────
  [styles]="styles"           [style]="styles"
  [css]="styles"              [scss]="styles"
  [themes]="styles"           [theme]="styles"
  [tokens]="styles"           [design-system]="styles"
  # ── Assets / Static ───────────────────────────────────
  [assets]="assets"           [asset]="assets"
  [images]="assets"           [image]="assets"
  [fonts]="assets"            [font]="assets"
  [public]="static"           [static]="static"
  # ── Types / Interfaces ────────────────────────────────
  [types]="types"             [type]="types"
  [interfaces]="types"        [interface]="types"
  [typings]="types"           [typing]="types"
  # ── Testing ───────────────────────────────────────────
  [tests]="tests"             [test]="tests"
  [__tests__]="tests"         [spec]="tests"
  [mocks]="tests"             [__mocks__]="tests"
  [fixtures]="tests"          [stubs]="tests"
  [e2e]="tests"               [cypress]="tests"
  [playwright]="tests"
  # ── Data ──────────────────────────────────────────────
  [data]="data"               [datasets]="data"
  [pipeline]="data"           [pipelines]="data"
  [loaders]="data"
)

# Segments that are transparent wrappers — skip and look deeper
GENERIC_SEGMENTS="src app dist build out packages apps"

get_scope() {
  local f="$1"
  local dir; dir=$(dirname "$f")
  [[ "$dir" == "." ]] && { echo "root"; return; }
  dir="${dir#./}"

  IFS='/' read -ra parts <<< "$dir"
  for seg in "${parts[@]}"; do
    local lower="${seg,,}"                          # lowercase
    # Skip generic wrappers
    local is_generic=0
    for g in $GENERIC_SEGMENTS; do [[ "$lower" == "$g" ]] && is_generic=1 && break; done
    [[ $is_generic -eq 1 ]] && continue
    # Return the canonical scope if we know this segment
    if [[ -n "${SEGMENT_SCOPE[$lower]}" ]]; then
      echo "${SEGMENT_SCOPE[$lower]}"; return
    fi
    # Unknown but specific enough segment — use it as-is
    echo "$lower"; return
  done

  # All parts were generic — just use the first one
  echo "${parts[0],,}"
}

# ══════════════════════════════════════════════════════════
#  DIFF ANALYSIS
#  Returns: new | feat | enhance | refactor | cleanup
# ══════════════════════════════════════════════════════════
get_diff_nature() {
  local f="$1"
  if ! git ls-files --error-unmatch "$f" &>/dev/null 2>&1; then
    echo "new"; return
  fi
  local adds dels
  adds=$(git diff HEAD -- "$f" 2>/dev/null | grep -c '^+[^+]'; true)
  dels=$(git diff HEAD -- "$f" 2>/dev/null | grep -c '^-[^-]'; true)
  adds=${adds:-0}
  dels=${dels:-0}
  local total=$((adds + dels))
  if   [ "$total" -eq 0 ];              then echo "new"
  elif [ "$adds" -gt $((dels * 3)) ];   then echo "feat"
  elif [ "$dels" -gt $((adds * 3)) ];   then echo "cleanup"
  elif [ "$adds" -ge "$dels" ];         then echo "enhance"
  else                                       echo "refactor"
  fi
}

# ══════════════════════════════════════════════════════════
#  COMMIT TYPE RESOLUTION
#  Priority: filename pattern > extension hint > diff nature
# ══════════════════════════════════════════════════════════
get_commit_type() {
  local f="$1" ext_type_hint="$2" nature="$3"

  # Filename-level overrides (strongest signal)
  case "$f" in
    *.test.*|*.spec.*|*__tests__*|*/__mocks__/*|*/fixtures/*)
      echo "test"; return ;;
    *CHANGELOG*|*CONTRIBUTING*|*README*|*/docs/*|*/doc/*)
      echo "docs"; return ;;
    *.github/*|*/ci/*|*Dockerfile*|*docker-compose*| \
    *Jenkinsfile*|*.gitlab-ci*|*/.circleci/*)
      echo "ci"; return ;;
    */migrations/*)
      echo "feat"; return ;;                # migrations always feat
    *fix*|*bug*|*patch*|*hotfix*)
      echo "fix"; return ;;
  esac

  # Extension hint is reliable for these types
  case "$ext_type_hint" in
    chore|ci|config|style|docs|test|types)
      echo "$ext_type_hint"; return ;;
  esac

  # Fall back to diff nature for code files
  case "$nature" in
    new|feat)    echo "feat"     ;;
    cleanup)     echo "chore"    ;;
    enhance)     echo "feat"     ;;
    refactor)    echo "refactor" ;;
    *)           echo "refactor" ;;
  esac
}

# ══════════════════════════════════════════════════════════
#  COMMIT MESSAGE GENERATOR
#  Produces specific, human-sounding messages by combining
#  the commit type, scope, file names, and language context.
# ══════════════════════════════════════════════════════════
generate_message() {
  local commit_type="$1"
  local scope="$2"
  local dominant_lang="$3"
  shift 3
  local files=("$@")
  local count="${#files[@]}"

  # Build a list of unique, clean file base-names (no extension, max 3)
  local names=()
  while IFS= read -r n; do names+=("$n"); done < <(
    for f in "${files[@]}"; do
      base="$(basename "$f")"
      # Strip double-extensions like .test.ts, .spec.js, .config.ts
      name="${base%%.*}"
      echo "$name"
    done | awk '!seen[$0]++' | grep -v '^$' | head -3
  )

  local n1="${names[0]:-}"
  local n2="${names[1]:-}"
  local n3="${names[2]:-}"

  # Build a natural name summary:  "foo", "foo and bar", "foo, bar and baz"
  local name_summary=""
  if   [[ -z "$n1" ]];                     then name_summary="files"
  elif [[ -z "$n2" ]];                     then name_summary="$n1"
  elif [[ -z "$n3" ]];                     then name_summary="$n1 and $n2"
  else                                          name_summary="$n1, $n2 and $n3"
  fi

  # Language qualifier appended when it adds useful context
  local lang_tag=""
  case "$dominant_lang" in
    python)     lang_tag=" in Python"   ;;
    go)         lang_tag=" in Go"       ;;
    ruby)       lang_tag=" in Ruby"     ;;
    rust)       lang_tag=" in Rust"     ;;
    java|kotlin) lang_tag=""            ;;  # scope usually says enough
    *)          lang_tag=""             ;;
  esac

  # Scope-aware phrasing — different domains call for different verbs/nouns
  local subject
  case "$commit_type" in
    feat)
      case "$scope" in
        components|ui|widgets|screens)
          [[ "$count" -gt 1 ]] \
            && subject="add $name_summary components" \
            || subject="add $name_summary component" ;;
        pages|views|layouts|templates)
          subject="add $name_summary ${scope%s}" ;;
        api|routes|controllers|handlers|resolvers)
          subject="add $name_summary ${scope%s} endpoint" ;;
        services|repositories|usecases)
          subject="implement $name_summary service" ;;
        hooks|composables)
          subject="add use${n1^} hook" ;;
        models|schemas|entities)
          subject="define $name_summary schema" ;;
        db|migrations)
          subject="add migration for $name_summary" ;;
        auth)
          subject="implement $name_summary auth flow" ;;
        workers|jobs)
          subject="add $name_summary background job" ;;
        store|context)
          subject="add $name_summary state slice" ;;
        data|pipeline)
          subject="add $name_summary data pipeline${lang_tag}" ;;
        *)
          subject="add $name_summary implementation${lang_tag}" ;;
      esac ;;

    fix)
      case "$scope" in
        api|routes|controllers|handlers)
          subject="fix $name_summary endpoint response" ;;
        auth)
          subject="fix auth flow in $name_summary" ;;
        db|models)
          subject="fix $name_summary query logic" ;;
        components|ui)
          subject="fix rendering issue in $name_summary" ;;
        styles)
          subject="fix layout regression in $name_summary" ;;
        *)
          subject="fix $name_summary in $scope" ;;
      esac ;;

    refactor)
      case "$scope" in
        utils|helpers|lib|common|shared)
          subject="refactor $name_summary utilities${lang_tag}" ;;
        store|context)
          subject="refactor $name_summary state management" ;;
        services|repositories)
          subject="refactor $name_summary service layer" ;;
        controllers|handlers)
          subject="refactor $name_summary controller logic" ;;
        models|schemas)
          subject="refactor $name_summary data model" ;;
        components|ui)
          subject="refactor $name_summary component structure" ;;
        *)
          subject="refactor $name_summary module${lang_tag}" ;;
      esac ;;

    chore)
      case "$scope" in
        deps)
          subject="update $dominant_lang dependencies" ;;
        assets|static)
          subject="update $name_summary static assets" ;;
        data)
          subject="update $name_summary data files" ;;
        scripts)
          subject="update $name_summary scripts" ;;
        *)
          subject="clean up $name_summary in $scope" ;;
      esac ;;

    docs)
      [[ "$n1" == "README" || "$n1" == "readme" ]] \
        && subject="update README" \
        || subject="update docs for $name_summary" ;;

    test)
      subject="add tests for $name_summary" ;;

    style)
      case "$scope" in
        styles|themes|tokens)
          subject="update $name_summary design tokens and styles" ;;
        components|ui)
          subject="update $name_summary component styles" ;;
        *)
          subject="update styles in $name_summary" ;;
      esac ;;

    config)
      case "$scope" in
        tooling)  subject="update $n1 tooling config"         ;;
        infra)    subject="update $n1 infrastructure config"  ;;
        *)        subject="update $name_summary configuration" ;;
      esac ;;

    ci)
      subject="update $name_summary CI/CD pipeline" ;;

    types)
      subject="add type definitions for $name_summary" ;;

    *)
      subject="update $name_summary${lang_tag}" ;;
  esac

  # Append file count for large batches (signals scope without being noisy)
  [[ $count -gt 6 ]] && subject="${subject} (${count} files)"

  echo "${commit_type}(${scope}): ${subject}"
}

# ══════════════════════════════════════════════════════════
#  GROUP FILES
#  Primary key  = semantic scope (from path)
#  Secondary key = extension domain (for root-level files)
#  This keeps e.g. all components/* together and all
#  *.config.* together even if spread across directories.
# ══════════════════════════════════════════════════════════
declare -A group_map

for f in "${FILES[@]}"; do
  scope=$(get_scope "$f")
  group_map["$scope"]+="$f "
done

group_keys=($(printf '%s\n' "${!group_map[@]}" | sort))
total_groups="${#group_keys[@]}"
echo "📁  $total_groups semantic groups detected: ${group_keys[*]}"
echo ""

# ══════════════════════════════════════════════════════════
#  BUILD COMMIT BATCHES
#  Keep semantically related files together.
#  Proportionally split large groups to honour NUM_COMMITS.
#  Merge tiny groups when groups > NUM_COMMITS.
# ══════════════════════════════════════════════════════════
BATCHES=()

if [ "$total_groups" -le "$NUM_COMMITS" ]; then
  commits_left=$NUM_COMMITS
  groups_left=$total_groups

  for key in "${group_keys[@]}"; do
    group_files=(${group_map[$key]})
    gcount="${#group_files[@]}"
    alloc=$(( (commits_left + groups_left - 1) / groups_left ))
    [[ $alloc -lt 1 ]] && alloc=1

    if [ "$gcount" -le "$alloc" ] || [ "$alloc" -eq 1 ]; then
      BATCHES+=("${group_files[*]}")
      commits_left=$(( commits_left - 1 ))
    else
      chunk=$(( (gcount + alloc - 1) / alloc ))
      idx=0
      for (( i=0; i<alloc && idx<gcount; i++ )); do
        BATCHES+=("${group_files[*]:$idx:$chunk}")
        commits_left=$(( commits_left - 1 ))
        idx=$(( idx + chunk ))
      done
    fi
    groups_left=$(( groups_left - 1 ))
  done
else
  per=$(( (TOTAL_FILES + NUM_COMMITS - 1) / NUM_COMMITS ))
  buf=()
  for key in "${group_keys[@]}"; do
    buf+=(${group_map[$key]})
    if [ "${#buf[@]}" -ge "$per" ]; then
      BATCHES+=("${buf[*]}")
      buf=()
    fi
  done
  [[ "${#buf[@]}" -gt 0 ]] && BATCHES+=("${buf[*]}")
fi

# ══════════════════════════════════════════════════════════
#  COMMIT LOOP
# ══════════════════════════════════════════════════════════
commit_count=0

for batch in "${BATCHES[@]}"; do
  batch_files=($batch)

  git add "${batch_files[@]}" >/dev/null 2>&1
  git diff --cached --quiet && continue   # nothing staged, skip

  # ── Per-file classification ──────────────────────────
  declare -A type_count scope_count lang_count domain_count

  for f in "${batch_files[@]}"; do
    IFS='|' read -r lang domain ext_hint <<< "$(classify_extension "$f")"
    nature=$(get_diff_nature "$f")
    t=$(get_commit_type "$f" "$ext_hint" "$nature")
    s=$(get_scope "$f")

    (( type_count[$t]++     )) || true
    (( scope_count[$s]++    )) || true
    (( lang_count[$lang]++  )) || true
    (( domain_count[$domain]++ )) || true
  done

  # ── Pick dominant values ─────────────────────────────
  commit_type=$(
    for k in "${!type_count[@]}"; do echo "${type_count[$k]} $k"; done \
    | sort -nr | head -1 | awk '{print $2}')

  commit_scope=$(
    for k in "${!scope_count[@]}"; do echo "${scope_count[$k]} $k"; done \
    | sort -nr | head -1 | awk '{print $2}')

  dominant_lang=$(
    for k in "${!lang_count[@]}"; do echo "${lang_count[$k]} $k"; done \
    | sort -nr | head -1 | awk '{print $2}')

  [[ -z "$commit_scope" ]] && commit_scope="misc"
  [[ -z "$dominant_lang" ]] && dominant_lang="code"

  message=$(generate_message \
    "$commit_type" "$commit_scope" "$dominant_lang" "${batch_files[@]}")

  git commit -m "$message" >/dev/null 2>&1
  echo "  ✅  [$((commit_count + 1))]  $message"
  commit_count=$(( commit_count + 1 ))

  unset type_count scope_count lang_count domain_count
done

echo ""
echo "🎉  Done — $commit_count commits created."