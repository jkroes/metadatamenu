---
icon: briefcase
folder: Projects
fields:
  - id: p00001
    name: status
    type: Select
    options:
      - planning
      - active
      - on-hold
      - complete
  - id: p00002
    name: priority
    type: Select
    options:
      - low
      - medium
      - high
      - critical
  - id: p00003
    name: lead
    type: File
    options:
      dvQueryString: "dv.pages('\"People\"')"
  - id: p00004
    name: team
    type: MultiFile
    options:
      dvQueryString: "dv.pages('\"People\"')"
  - id: p00005
    name: partners
    type: MultiFile
    options:
      dvQueryString: "dv.pages('\"Organizations\"')"
  - id: p00006
    name: resources
    type: MultiFile
    options:
      dvQueryString: "dv.pages('\"References\"')"
  - id: p00007
    name: start_date
    type: Date
    options: {}
  - id: p00008
    name: due_date
    type: Date
    options: {}
---
