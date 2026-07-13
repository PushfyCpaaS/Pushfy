module github.com/PushfyCpaaS/pushfy-go/examples/go

go 1.21

require github.com/PushfyCpaaS/pushfy-go v0.0.0

// This monorepo builds the examples against the SDK in the sibling directory.
// In a standalone project drop this replace and rely on `go get` instead.
replace github.com/PushfyCpaaS/pushfy-go => ../../sdks/go
