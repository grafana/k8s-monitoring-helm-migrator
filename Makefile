V1_VALUES_SOURCE = k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples
V1_VALUES_ORIGINAL := $(shell find $(V1_VALUES_SOURCE) -name values.yaml)
V1_VALUES_DESIRED := $(V1_VALUES_ORIGINAL:k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples/%/values.yaml=test-from-v1/%/v1-values.yaml)
V1_VALUES_INPUT = $(shell find test-from-v1 -name v1-values.yaml)
V1_TO_V3_VALUES_OUTPUT = $(V1_VALUES_INPUT:v1-values.yaml=v3-values.yaml)
V1_TO_V4_VALUES_OUTPUT = $(V1_VALUES_INPUT:v1-values.yaml=v4-values.yaml)

V3_VALUES_SOURCE = k8s-monitoring-helm/charts/k8s-monitoring/docs/examples
V3_VALUES_ORIGINAL := $(shell find $(V3_VALUES_SOURCE) -name values.yaml)
V3_VALUES_DESIRED := $(V3_VALUES_ORIGINAL:k8s-monitoring-helm/charts/k8s-monitoring/docs/examples/%/values.yaml=test-from-v3/%/v3-values.yaml)
V3_VALUES_INPUT = $(shell find test-from-v3 -name v3-values.yaml)
V3_TO_V4_VALUES_OUTPUT = $(V3_VALUES_INPUT:v3-values.yaml=v4-values.yaml)

HELM_CHART = grafana/k8s-monitoring
V1_CHART_VERSION = $(shell helm search repo $(HELM_CHART) --versions --output json | jq -r '[.[] | select(.version | startswith("1."))][0].version')
V3_CHART_VERSION = $(shell helm search repo $(HELM_CHART) --versions --output json | jq -r '[.[] | select(.version | startswith("3."))][0].version')
V4_CHART_VERSION = $(shell helm search repo $(HELM_CHART) --versions --output json | jq -r '[.[] | select(.version | startswith("4."))][0].version')

.PHONY: update-submodules
update-submodules:
	git submodule update --init --remote k8s-monitoring-helm

.SECONDEXPANSION:
test-from-v1/%/v1-values.yaml: $$(wildcard $(V1_VALUES_SOURCE)/%/values.yaml)
	@mkdir -p test-from-v1/$(shell dirname $< | sed -e 's,$(V1_VALUES_SOURCE),,')
	cp $< $@

.SECONDEXPANSION:
test-from-v3/%/v3-values.yaml: $$(wildcard $(V3_VALUES_SOURCE)/%/values.yaml)
	@mkdir -p test-from-v3/$(shell dirname $< | sed -e 's,$(V3_VALUES_SOURCE),,')
	cp $< $@

.PHONY: copyOriginals
copyOriginals: clean $(V1_VALUES_DESIRED) $(V3_VALUES_DESIRED)

test-from-v1/%/v3-values.yaml: test-from-v1/%/v1-values.yaml cli.js migrate.js
	node cli.js --mode v1-to-v3 $< > $@

test-from-v1/%/v4-values.yaml: test-from-v1/%/v1-values.yaml cli.js migrate.js
	node cli.js --mode v1-to-v4 $< > $@

test-from-v3/%/v4-values.yaml: test-from-v3/%/v3-values.yaml cli.js migrate-v3-to-v4.js
	node cli.js --mode v3-to-v4 $< > $@

.PHONY: build
build: $(V1_TO_V3_VALUES_OUTPUT) $(V1_TO_V4_VALUES_OUTPUT) $(V3_TO_V4_VALUES_OUTPUT)

.PHONY: clean
clean:
	rm -rf test-from-v1/*
	rm -rf test-from-v3/*

.PHONY: test-v1
test-v1: $(V1_VALUES_INPUT)
	@echo "Using k8s-monitoring chart version $(V1_CHART_VERSION)"
	for valuesFile in $(V1_VALUES_INPUT); do \
  		echo "Testing V1 values file: $${valuesFile}"; \
		helm template k8smon $(HELM_CHART) --version $(V1_CHART_VERSION) -f $${valuesFile} > /dev/null; \
	done

.PHONY: test-v3
test-v3: $(V1_TO_V3_VALUES_OUTPUT)
	@echo "Using k8s-monitoring chart version $(V3_CHART_VERSION)"
	for valuesFile in $(V1_TO_V3_VALUES_OUTPUT); do \
  		echo "Testing V3 values file: $${valuesFile}"; \
		helm template k8smon $(HELM_CHART) --version $(V3_CHART_VERSION) -f $${valuesFile} > /dev/null; \
	done

.PHONY: test-v4
test-v4: $(V3_TO_V4_VALUES_OUTPUT)
	@echo "Using k8s-monitoring chart version $(V4_CHART_VERSION)"
	for valuesFile in $(V3_TO_V4_VALUES_OUTPUT); do \
		echo "Testing V4 values file: $${valuesFile}"; \
		helm template k8smon $(HELM_CHART) --version $(V4_CHART_VERSION) --devel -f $${valuesFile} > /dev/null; \
	done

.PHONY: test-web
test-web:
	yarn run test:web

.PHONY: test
test: test-v1 test-v3 test-v4 test-web
