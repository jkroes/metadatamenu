---
icon: building
folder: Organizations
fields:
  - id: o00001
    name: type
    type: Select
    options:
      - industry
      - academia
      - nonprofit
      - government
  - id: o00002
    name: areas
    type: Multi
    options:
      - AI research
      - systems
      - HCI
      - policy
      - education
      - security
  - id: o00003
    name: website
    type: Input
    options: {}
  - id: o00004
    name: contacts
    type: MultiFile
    options:
      dvQueryString: dv.pages('"People"')
limit: 20
excludes:
extends:
savedViews: []
favoriteView:
fieldsOrder:
  - o00004
  - o00003
  - o00002
  - o00001
version: "2.0"
---
