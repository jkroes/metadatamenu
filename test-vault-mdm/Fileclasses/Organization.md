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
      dvQueryString: "dv.pages('\"People\"')"
---
