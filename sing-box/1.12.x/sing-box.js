const { type, name, platform = 'linux', fakeip = false } = $arguments
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

config.outbounds.push(...proxies)

config.outbounds.map(i => {
  if (['all', 'all-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies))
  }
  if (['hk', 'hk-auto', 'asia', 'asia-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /港|hk|hongkong|kong kong|🇭🇰/i))
  }
  if (['tw', 'tw-auto', 'asia', 'asia-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /台|tw|taiwan|🇹🇼/i))
  }
  if (['jp', 'jp-auto', 'asia', 'asia-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /日本|jp|japan|🇯🇵/i))
  }
  if (['sg', 'sg-auto', 'asia', 'asia-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i))
  }
  if (['us', 'us-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /美|us|unitedstates|united states|🇺🇸/i))
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

// Add auto_redirect to tun inbounds if platform is linux
if (platform === 'linux') {
  config.inbounds = config.inbounds?.map(inbound => {
    if (inbound.type === 'tun') {
      return {
        ...inbound,
        auto_redirect: true
      }
    }
    return inbound
  }) || []
}

// === 修改 local-dns 的 address，根据平台类型 ===
const localDns = config.dns?.servers?.find(s => s.tag === 'local-dns');
if (localDns) {
  if (['ios', 'android'].includes(platform)) {
    localDns.address = 'local';
  } else if (['linux', 'mac', 'win'].includes(platform)) {
    localDns.address = 'dhcp://auto';
  } else {
    // 其他平台不做修改
    // localDns.address = 'dhcp://auto';
  }
}

// fakeip 配置
if (fakeip) {
  // 1. 添加 dns.fakeip
  if (config.dns) {
    config.dns.fakeip = {
      enabled: true,
      inet4_range: "198.18.0.0/15",
      inet6_range: "fc00::/18"
    };
  }

  // 2. 添加 dns.servers.fakeip
  if (Array.isArray(config.dns?.servers)) {
    const hasFakeIpServer = config.dns.servers.some(s => s.tag === 'fakeip-dns');
    if (!hasFakeIpServer) {
      config.dns.servers.push({
        tag: 'fakeip-dns',
        address: 'fakeip'
      });
    }
  }

  // 3. 添加dns.rules
  if (Array.isArray(config.dns?.rules)) {
    // Global server 改为 fakeip-dns
    for (const rule of config.dns.rules) {
      if (rule.clash_mode === 'Global') {
        rule.server = 'fakeip-dns';
        break;
      }
    }

    // 在倒数第二个位置插入
    const ruleToInsert = {
      "query_type": ["A", "AAAA"],
      "action": "route",
      "server": "fakeip-dns",
      "rewrite_ttl": 1
    };
    const insertIndex = Math.max(0, config.dns.rules.length - 1);
    config.dns.rules.splice(insertIndex, 0, ruleToInsert);
  }

  // 4. 添加 experimental.cache_file.store_fakeip
  if (config.experimental?.cache_file) {
    config.experimental.cache_file.store_fakeip = true;
  }
}

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
