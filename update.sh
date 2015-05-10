#!/bin/bash
zcat net.zone.gz | awk '{print $1}' | sort | uniq | awk '{print length($1), $1}' | sort -n | awk '{print $2 ".NET"}' >net.sortbylen
zcat com.zone.gz | awk '{print $1}' | sort | uniq | awk '{print length($1), $1}' | sort -n | awk '{print $2 ".COM"}' >com.sortbylen
zcat org.zone.gz | awk '{print $1}' | sort | uniq | awk '{print length($0), substr($0,1,length($0)-1)}' | sort -n | awk '{print $2}' >org.so
rtbylen
cat *.sortbylen | sort -n | node import-domains.js
