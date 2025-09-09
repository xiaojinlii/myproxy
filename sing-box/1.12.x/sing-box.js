const { 
  type, 
  name, 
  platform = 'linux',
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
  if (['hk', 'hk-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /港|hk|hongkong|kong kong|🇭🇰/i))
  }
  if (['tw', 'tw-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /台|tw|taiwan|🇹🇼/i))
  }
  if (['jp', 'jp-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /日本|jp|japan|🇯🇵/i))
  }
  if (['sg', 'sg-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i))
  }
  if (['us', 'us-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /美|us|unitedstates|united states|🇺🇸/i))
  }
  if (['other', 'other-auto'].includes(i.tag)) {
    const regex = /^(?!.*(?:港|hk|hongkong|kong kong|🇭🇰|台|tw|taiwan|🇹🇼|日本|jp|japan|🇯🇵|新|sg|singapore|🇸🇬|美|us|unitedstates|united states|🇺🇸)).*$/i;
    i.outbounds.push(...getTags(proxies, regex))
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
    }
  }

}

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
