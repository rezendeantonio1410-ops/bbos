# One-off verifiable backup job (Render cron, triggered manually).
FROM postgres:18
COPY backup-and-verify.sh /usr/local/bin/backup-and-verify.sh
RUN chmod +x /usr/local/bin/backup-and-verify.sh
ENTRYPOINT ["/usr/local/bin/backup-and-verify.sh"]
