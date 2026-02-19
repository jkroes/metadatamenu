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
      dvQueryString: "dv.pages('\"Organizations\"')"
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
---
