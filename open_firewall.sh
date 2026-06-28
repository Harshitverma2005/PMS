#!/bin/bash
# Open port 8003 for external access

# Try UFW (Ubuntu/Debian)
if command -v ufw &> /dev/null; then
    sudo ufw allow 8003/tcp
    sudo ufw status
fi

# Try firewall-cmd (RHEL/CentOS)
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=8003/tcp
    sudo firewall-cmd --reload
fi

# Try iptables
if command -v iptables &> /dev/null; then
    sudo iptables -I INPUT -p tcp --dport 8003 -j ACCEPT
    sudo iptables-save
fi

echo "Firewall rules updated. Testing..."
curl -s http://localhost:8003/health
