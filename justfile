# List available recipes
default:
  @just --list

# Remove build artifacts
clean:
  ./scripts/clean.sh
