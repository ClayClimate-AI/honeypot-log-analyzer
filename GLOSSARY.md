# Cowrie AI Summarizer

A defensive learning app: a local SSH honeypot records attacker activity, and an AI summarizes cleaned samples of it for a security analyst.

## Language

**Honeypot**:
The local Cowrie instance on Joseph's Mac that pretends to be an SSH server and records everything a visitor does.
_Avoid_: server, sensor, trap

**Event**:
One line of a Cowrie log, describing a single thing that happened (a login attempt, a command, a disconnect).
_Avoid_: entry, record, log line

**Session**:
All events from one SSH connection to the honeypot, from connect to disconnect.
_Avoid_: attack, connection, visit

**Log excerpt**:
The text a user pastes or loads into the dashboard to be summarized.
_Avoid_: input, log, file

**Sample fixture**:
A fixed, sanitized log excerpt committed to the repo so anyone can try the summarizer without owning a honeypot.
_Avoid_: demo data, test log, sample file

**Summary**:
The AI's short plain-text explanation of a log excerpt for a security analyst: what happened, what it means, what to watch.
_Avoid_: analysis, report, result

**Threat label**:
The AI's severity rating for a log excerpt: low, medium, high, or unknown when the excerpt is too unclear to judge.
_Avoid_: severity, risk score, rating

**Sanitization**:
Producing a shareable log excerpt by keeping only allowlisted fields and replacing anything that identifies Joseph's setup.
_Avoid_: cleaning, scrubbing, redaction
