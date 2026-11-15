const { 
  type, 
  name, 
  platform = 'linux',
  home = false,
  fakeip = false,
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
    i.outbounds.push(...getTags(proxies, /(港|hk|hongkong|kong kong|🇭🇰)/i));
  }
  if (['jp', 'jp-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /(日本|jp|japan|🇯🇵)/i));
  }
  if (['sg', 'sg-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i));
  }
  if (['us', 'us-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /(美|us|unitedstates|united states|🇺🇸)/i));
  }
  if (['other', 'other-auto'].includes(i.tag)) {
    const regex = /(?!.*(?:港|hk|hongkong|kong kong|🇭🇰|日本|jp|japan|🇯🇵|新|sg|singapore|🇸🇬|美|us|unitedstates|united states|🇺🇸)).*$/i;
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


// ===== fakeip ===== //
if (fakeip === true || fakeip === 'true') {
  // 1. 添加 dns.servers.fakeip
  if (Array.isArray(config.dns?.servers)) {
    const hasFakeIpServer = config.dns.servers.some(s => s.tag === 'fakeip-dns');
    if (!hasFakeIpServer) {
      config.dns.servers.push({
        tag: 'fakeip-dns',
        type: 'fakeip',
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18"
      });
    }
  }

  // 2. 添加dns.rules
  if (Array.isArray(config.dns?.rules)) {
    // Global server 改为 fakeip-dns
    for (const rule of config.dns.rules) {
      if (rule.clash_mode === 'Global') {
        rule.server = 'fakeip-dns';
        break;
      }
    }

    // 删除最后一个规则
    if (config.dns.rules.length > 0) {
      config.dns.rules.pop(); // 移除最后一个
    }

    const ruleToInsert = {
      "query_type": ["A", "AAAA"],
      "action": "route",
      "server": "fakeip-dns",
      "rewrite_ttl": 1
    };

    // 将新规则添加到最后
    config.dns.rules.push(ruleToInsert);
  }

  // 3. 添加 experimental.cache_file.store_fakeip
  if (config.experimental?.cache_file) {
    config.experimental.cache_file.store_fakeip = true;
  }
}


// ===== home ===== //
if (home === true || home === 'true') {
  // 设备连接家里wifi时，访问局域网服务，直接通过路由表进行路由，不会进入singbox内核，所以不用额外处理
  // macOS通过命令netstat -nr查看路由表，来证实上述结论
  // 但iOS和Android查看不了路由表，无法证实，但确实没进入singbox内核

  // 1. 添加 home outbounds
  const home_urltest = {
    tag: 'home',
    type: 'selector',
    outbounds: []
  };

  // 将所有包含home的节点插入到此分组中
  home_urltest.outbounds.push(...getTagsWithHome(proxies));

  // 找到倒数第三个位置的索引
  const insertIndex = Math.max(0, config.outbounds.length - 2);
  config.outbounds.splice(insertIndex, 0, home_urltest);

  // 2. 添加 home rules
  const home_rules = [
    {
        "rule_set": "geo-home",
        "outbound": "home"
    }
  ];

  if (Array.isArray(config.route?.rules)) {
    // 找到 {"ip_is_private": true, "outbound": "direct"} 的索引
    const privateIpDirectIndex = config.route.rules.findIndex(rule => 
        rule.ip_is_private === true
    );

    if (privateIpDirectIndex !== -1) {
        // 将 home_rules 插入到找到的规则之前
        config.route.rules.splice(privateIpDirectIndex, 0, ...home_rules);
    } else {
        // 如果默认的 private IP 规则不存在，将 home_rules 插入到规则数组的开头
        config.route.rules.unshift(...home_rules);
    }
  }
}


// ===== platform ===== //
if (platform === 'linux') {
  if (Array.isArray(config.inbounds)) {
    const tunInbound = config.inbounds.find(inbound => inbound.type === 'tun')
    if (tunInbound) {
      tunInbound.auto_redirect = true
    }
  }
}
else if (platform === 'win') {
  if (Array.isArray(config.inbounds)) {
    const mixedInbound = config.inbounds.find(inbound => inbound.type === 'mixed')
    if (mixedInbound) {
      mixedInbound.set_system_proxy = true
    }
  }
}
else if (platform === 'momo') {
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


$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  const filteredProxies = proxies.filter(p => !/home/i.test(p.tag));
  return (regex ? filteredProxies.filter(p => regex.test(p.tag)) : filteredProxies).map(p => p.tag)
}

function getTagsWithHome(proxies) {
  // 此函数用于获取所有 tag 包含 'home' 的节点
  const filteredProxies = proxies.filter(p => /home/i.test(p.tag));
  return filteredProxies.map(p => p.tag)
}
