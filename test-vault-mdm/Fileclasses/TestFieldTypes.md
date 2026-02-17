---
limit: 100
mapWithTag: false
icon: test-tube
tagNames: []
filesPaths:
  - TestFiles
bookmarksGroups: []
excludes:
extends:
savedViews: []
favoriteView:
fieldsOrder:
  - tf-select
  - tf-file
  - tf-multifile
version: "2.14"
fields:
  - name: status
    type: Select
    options:
      sourceType: ValuesList
      valuesList:
        "1": todo
        "2": in-progress
        "3": done
    path: ""
    id: tf-select
  - name: link
    type: File
    options: {}
    path: ""
    id: tf-file
  - name: related
    type: MultiFile
    options: {}
    path: ""
    id: tf-multifile
---
