V1_VALUES_ORIGINAL = $(shell find ../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples -name values.yaml)
V1_VALUES = $(shell find ../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples -name values.yaml | sed 's|../k8s-monitoring-helm/charts/k8s-monitoring-v1/docs/examples/|test/|; s|/values.yaml$$|/v1-values.yaml|')
V2_VALUES = $(V1_VALUES:v1-values.yaml=v2-values.yaml)

copyOriginals:
	for valuesFile in $(V1_VALUES_ORIGINAL); do \
  		mkdir -p test/$$(basename $$(dirname $${valuesFile})); \
  		cp $${valuesFile} test/$$(basename $$(dirname $${valuesFile}))/v1-values.yaml; \
	done

%/v2-values.yaml: %/v1-values.yaml cli.js migrate.js
	node cli.js $< > $@

build: $(V2_VALUES)
clean:
	rm $(V2_VALUES)
