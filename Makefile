V1_VALUES_ORIGINAL = $(shell find ../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples -name values.yaml)
V1_VALUES = $(shell find ../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples -name values.yaml | sed 's|../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples/|test/|; s|/values.yaml$$|/v1-values.yaml|')
V2_VALUES = $(V1_VALUES:v1-values.yaml=v2-values.yaml)

.PHONY: copyOriginals
test/%/v1-values.yaml: ../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples/%/values.yaml
	mkdir -p test/$$(basename $$(dirname $<))
	cp $< $@
copyOriginals: $(V1_VALUES)

%/v2-values.yaml: %/v1-values.yaml cli.js migrate.js
	node cli.js $< > $@

.PHONY: build
build: $(V2_VALUES)

.PHONY: clean
clean:
	rm -f $(V2_VALUES) $(V1_VALUES)

.PHONY: test-v1
test-v1: $(V1_VALUES)
	for valuesFile in $(V1_VALUES); do \
  		echo "Testing V1 values file: $${valuesFile}"; \
		helm template k8smon grafana/k8s-monitoring --version ^1 -f $${valuesFile} > /dev/null; \
	done

.PHONY: test-v2
test-v2: $(V2_VALUES)
	for valuesFile in $(V2_VALUES); do \
  		echo "Testing V2 values file: $${valuesFile}"; \
		helm template k8smon grafana/k8s-monitoring --version ^2 -f $${valuesFile} > /dev/null; \
	done

.PHONY: test
test: test-v1 test-v2
