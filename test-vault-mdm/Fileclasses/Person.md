---
icon: user
folder: People
fields:
  - id: n00001
    name: role
    type: Select
    options:
      - researcher
      - engineer
      - designer
      - PM
      - executive
      - advisor
  - id: n00002
    name: organization
    type: File
    options:
      dvQueryString: dv.pages('"Organizations"')
  - id: n00003
    name: expertise
    type: Multi
    options:
      - machine learning
      - systems
      - HCI
      - NLP
      - security
      - data engineering
      - product
      - research
  - id: n00004
    name: email
    type: Input
    options: {}
  - id: n00005
    name: website
    type: Input
    options: {}
limit: 20
excludes:
extends:
savedViews: []
favoriteView:
fieldsOrder:
  - n00005
  - n00004
  - n00003
  - n00002
  - n00001
version: "2.0"
---
