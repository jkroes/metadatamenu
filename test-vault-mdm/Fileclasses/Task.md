---
icon: check-square
folder: Tasks
fields:
  - id: t00001
    name: status
    type: Select
    options:
      - todo
      - in-progress
      - review
      - done
  - id: t00002
    name: priority
    type: Select
    options:
      - low
      - medium
      - high
      - critical
  - id: t00003
    name: effort
    type: Select
    options:
      - XS
      - S
      - M
      - L
      - XL
  - id: t00004
    name: project
    type: File
    options:
      dvQueryString: "dv.pages('\"Projects\"')"
  - id: t00005
    name: assignee
    type: File
    options:
      dvQueryString: "dv.pages('\"People\"')"
  - id: t00006
    name: blocked_by
    type: MultiFile
    options:
      dvQueryString: "dv.pages('\"Tasks\"')"
  - id: t00007
    name: due_date
    type: Date
    options: {}
---
