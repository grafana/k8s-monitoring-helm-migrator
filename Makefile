V1_VALUES_SOURCE = ../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples
V1_VALUES_ORIGINAL := $(shell find $(V1_VALUES_SOURCE) -name values.yaml)
V1_VALUES_DESIRED := $(V1_VALUES_ORIGINAL:../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples/%/values.yaml=test/%/v1-values.yaml)
V1_VALUES = $(shell find test -name v1-values.yaml)
V2_VALUES = $(V1_VALUES:v1-values.yaml=v2-values.yaml)

.SECONDEXPANSION:
test/%/v1-values.yaml: $$(wildcard $(V1_VALUES_SOURCE)/%/values.yaml)
	mkdir -p test/$$(basename $$(dirname $<))
	cp $< $@

.PHONY: copyOriginals
copyOriginals: clean-v1-values $(V1_VALUES_DESIRED)

%/v2-values.yaml: %/v1-values.yaml cli.js migrate.js
	node cli.js $< > $@

.PHONY: build
build: $(V2_VALUES)

.PHONY: clean
clean:
	rm -f $(V2_VALUES)

clean-v1-values:
	rm -f $(V1_VALUES_DESIRED)

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

.PHONY: test-v3
test-v3: $(V2_VALUES)
	for valuesFile in $(V2_VALUES); do \
  		echo "Testing V3 values file: $${valuesFile}"; \
		helm template k8smon grafana/k8s-monitoring --version ^3 -f $${valuesFile} > /dev/null; \
	done

.PHONY: test-web
test-web:
	yarn run test:web

.PHONY: test
test: test-v1 test-v2 test-v3 test-web
