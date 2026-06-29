#!/bin/bash

# Test all 28 transformations
BASE_URL="https://textforge.co/transform"

declare -A TRANSFORMATIONS=(
  # Formatting
  ["slugify"]="Hello World:hello-world"
  ["camelcase"]="hello world:helloWorld"
  ["snakecase"]="Hello World:hello_world"
  ["kebabcase"]="Hello World:hello-world"
  ["pascalcase"]="hello world:HelloWorld"
  ["constantcase"]="hello world:HELLO_WORLD"
  ["capitalize"]="hello world:Hello world"
  ["titlecase"]="hello world:Hello World"
  ["sentencecase"]="HELLO WORLD:Hello world"
  
  # String manipulation
  ["reverse"]="hello:olleh"
  ["uppercase"]="hello:HELLO"
  ["lowercase"]="HELLO:hello"
  ["trim"]="  hello  :hello"
  ["truncate"]="hello world:hello..."
  
  # Encoding/decoding
  ["base64encode"]="hello:aGVsbG8="
  ["base64decode"]="aGVsbG8=:hello"
  ["urlencode"]="hello world:hello%20world"
  ["urldecode"]="hello%20world:hello world"
  ["htmlencode"]="<div>:&lt;div&gt;"
  ["htmldecode"]="&lt;div&gt;:<div>"
  
  # Analysis
  ["wordcount"]="hello world foo:3"
  ["charcount"]="hello:5"
  ["linecount"]="line1\nline2\nline3:3"
  
  # Extraction
  ["extractemails"]="test@example.com:['test@example.com']"
  ["extracturls"]="https://example.com:['https://example.com']"
  ["extractnumbers"]="I have 5 apples:[5]"
  
  # Cleaning
  ["removehtml"]="<p>Hello</p>:Hello"
  ["removespecial"]="hello!@#\$world:helloworld"
)

pass=0
fail=0

for action in "${!TRANSFORMATIONS[@]}"; do
  IFS=':' read -r input expected <<< "${TRANSFORMATIONS[$action]}"
  
  # URL encode the input
  encoded_input=$(printf %s "$input" | jq -sRr @uri)
  
  response=$(curl -s "${BASE_URL}?text=${encoded_input}&action=${action}")
  
  # Extract result from JSON
  actual=$(echo "$response" | jq -r '.result // .error // "null"')
  
  if [ "$actual" = "$expected" ]; then
    echo "✓ $action"
    ((pass++))
  else
    echo "✗ $action (expected: $expected, got: $actual)"
    ((fail++))
  fi
done

echo ""
echo "Summary: $pass passed, $fail failed"
