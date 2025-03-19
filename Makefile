
build:
	anchor build

test: clean
	./test.sh

check-format:
	cargo fmt --check
	cargo clippy --workspace --tests -- --warn clippy::all

clean:
	anchor clean