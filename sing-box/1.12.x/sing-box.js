const { 
  type, 
  name, 
  platform = 'linux',
  home = false,
} = $arguments

const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

let compatible
let config = JSON.parse($files[0])
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})


// ===== outbounds ===== //
config.outbounds.push(...proxies)

config.outbounds.map(i => {
  if (['all', 'all-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies))
  }

  if (['stream-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /流媒体/i));
  }

  if (['hk', 'hk-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*流媒体).*(港|hk|hongkong|kong kong|🇭🇰)/i));
  }
  if (['tw', 'tw-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*流媒体).*(台|tw|taiwan|🇹🇼)/i));
  }
  if (['jp', 'jp-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*流媒体).*(日本|jp|japan|🇯🇵)/i));
  }
  if (['kr', 'kr-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*流媒体).*(韩|kr|korea|🇰🇷)/i));
  }
  if (['sg', 'sg-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*流媒体)(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i));
  }
  if (['us', 'us-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*流媒体).*(美|us|unitedstates|united states|🇺🇸)/i));
  }
  if (['other', 'other-auto'].includes(i.tag)) {
    const regex = /^(?!.*流媒体)(?!.*(?:港|hk|hongkong|kong kong|🇭🇰|台|tw|taiwan|🇹🇼|日本|jp|japan|🇯🇵|韩|kr|korea|🇰🇷|新|sg|singapore|🇸🇬|美|us|unitedstates|united states|🇺🇸)).*$/i;
    i.outbounds.push(...getTags(proxies, regex));
  }

})

config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    outbound.outbounds.push(compatible_outbound.tag);
  }
});

// ===== linux ===== //
if (platform === 'linux') {
  if (Array.isArray(config.inbounds)) {
    const tunInbound = config.inbounds.find(inbound => inbound.type === 'tun')
    if (tunInbound) {
      tunInbound.auto_redirect = true
    }
  }
}

// ===== win ===== //
if (platform === 'win') {
  if (Array.isArray(config.inbounds)) {
    const mixedInbound = config.inbounds.find(inbound => inbound.type === 'mixed')
    if (mixedInbound) {
      mixedInbound.set_system_proxy = true
    }
  }
}

// ===== momo ===== //
if (platform === 'momo') {
  // 1. 修改 experimental
  config.experimental.clash_api.external_ui = '/etc/momo/run/ui'
  config.experimental.cache_file.path = '/etc/momo/run/cache.db'

  // 2. 修改 hijack-dns
  if (Array.isArray(config.route?.rules)) {
    config.route.rules = config.route.rules.map(rule => {
      if (rule.action === 'hijack-dns') {
        return {
          inbound: "dns-in",
          action: "hijack-dns"
        }
      }
      return rule
    })
  }

  // 3. 替换 fakeip tag
  if (config.dns) {
    const FAKEIP_DNS_TAG_OLD = 'fakeip-dns'
    const FAKEIP_DNS_TAG_NEW = 'fake-ip-dns-server'

    if (Array.isArray(config.dns.servers)) {
      config.dns.servers = config.dns.servers.map(server => {
        if (server.tag === FAKEIP_DNS_TAG_OLD) {
          server.tag = FAKEIP_DNS_TAG_NEW
        }
        return server
      })
    }

    if (Array.isArray(config.dns.rules)) {
      config.dns.rules = config.dns.rules.map(rule => {
        if (rule.server === FAKEIP_DNS_TAG_OLD) {
          rule.server = FAKEIP_DNS_TAG_NEW
        }
        return rule
      })
    }

    if (config.dns.final === FAKEIP_DNS_TAG_OLD) {
      config.dns.final = FAKEIP_DNS_TAG_NEW
    }
  }

  // 4. 修改 inbounds
  if (Array.isArray(config.inbounds)) {
    config.inbounds.unshift({
        tag: "dns-in",
        type: "direct",
        listen: "::",
        listen_port: 1053
    })

    const tunInbound = config.inbounds.find(inbound => inbound.type === 'tun')
    if (tunInbound) {
      tunInbound.tag = 'tun-in'
      tunInbound.auto_route = false
      tunInbound.auto_redirect = false
      tunInbound.strict_route = false

      // 将 tag 放到第一位
      const tunIndex = config.inbounds.findIndex(ib => ib.type === 'tun')
      const { tag, ...rest } = tunInbound
      config.inbounds[tunIndex] = {
        tag: tag,
        ...rest
      }
    }
  }

}

console.log(`================>home:${home}`);
// ===== home ===== //
if (home === true) {
  console.log(`================>home:11111`);
    const home_rules = [
        {
            "type": "logical",
            "mode": "and",
            "rules": [
                { "wifi_ssid": ["朕的wifi，福泽天下", "朕的wifi，共享天下"] },
                { "ip_cidr": ["172.16.1.0/24"] }
            ],
            "outbound": "direct"
        },
        {
            "ip_cidr": ["172.16.1.0/24"],
            "outbound": "home"
        }
    ];

    if (Array.isArray(config.route?.rules)) {
        // 1. 找到 {"ip_is_private": true, "outbound": "direct"} 的索引
        const privateIpDirectIndex = config.route.rules.findIndex(rule => 
            rule.ip_is_private === true
        );

        if (privateIpDirectIndex !== -1) {
            // 2. 将 home_rules 插入到找到的规则之前
            config.route.rules.splice(privateIpDirectIndex, 0, ...home_rules);
        } else {
            // 如果默认的 private IP 规则不存在，将 home_rules 插入到规则数组的开头
            config.route.rules.unshift(...home_rules);
        }
    }
}

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
