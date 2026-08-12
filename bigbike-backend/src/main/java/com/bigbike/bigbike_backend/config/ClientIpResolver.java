package com.bigbike.bigbike_backend.config;

import jakarta.servlet.http.HttpServletRequest;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Resolves the client address only from a direct, configured proxy hop. A forwarded header must
 * be exactly one literal IP: accepting an attacker-provided multi-hop chain would turn it into a
 * rate-limit bypass.
 */
@Component
public class ClientIpResolver {

    private static final Pattern IPV4_LITERAL = Pattern.compile("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$");
    private static final Pattern IPV6_LITERAL = Pattern.compile("^[0-9A-Fa-f:.]+$");

    private final List<ProxyMatcher> trustedProxies;

    public ClientIpResolver(
            @Value("${bigbike.trusted-proxies:127.0.0.1,::1}") String trustedProxiesConfig
    ) {
        this.trustedProxies = parseTrustedProxies(trustedProxiesConfig);
    }

    /**
     * Returns the direct address unless the direct peer is trusted and the ingress supplied one
     * canonical address. Invalid data deliberately falls back to the direct peer rather than
     * guessing a client-controlled value.
     */
    public String resolve(HttpServletRequest request) {
        String remote = canonicalLiteral(request.getRemoteAddr());
        if (remote == null) {
            return "unknown";
        }
        if (!isTrustedProxy(remote)) {
            return remote;
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank() || forwarded.indexOf(',') >= 0) {
            return remote;
        }
        String candidate = canonicalLiteral(forwarded.trim());
        return candidate == null ? remote : candidate;
    }

    public boolean isTrustedProxy(String address) {
        String canonical = canonicalLiteral(address);
        return canonical != null && trustedProxies.stream().anyMatch(matcher -> matcher.matches(canonical));
    }

    private static List<ProxyMatcher> parseTrustedProxies(String rawConfig) {
        if (rawConfig == null || rawConfig.isBlank()) {
            throw new IllegalArgumentException("bigbike.trusted-proxies must contain at least one trusted proxy");
        }
        List<ProxyMatcher> matchers = new ArrayList<>();
        for (String value : rawConfig.split(",")) {
            String entry = value.trim();
            if (entry.isEmpty()) {
                throw new IllegalArgumentException("bigbike.trusted-proxies contains an empty entry");
            }
            matchers.add(ProxyMatcher.parse(entry));
        }
        return List.copyOf(matchers);
    }

    private static String canonicalLiteral(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String candidate = value.trim();
        boolean likelyV4 = IPV4_LITERAL.matcher(candidate).matches();
        boolean likelyV6 = candidate.indexOf(':') >= 0 && IPV6_LITERAL.matcher(candidate).matches();
        if (!likelyV4 && !likelyV6) {
            return null;
        }
        try {
            InetAddress parsed = InetAddress.getByName(candidate);
            if (!(parsed instanceof Inet4Address) && !(parsed instanceof Inet6Address)) {
                return null;
            }
            return parsed.getHostAddress();
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    private static final class ProxyMatcher {

        private final byte[] network;
        private final int prefixBits;

        private ProxyMatcher(byte[] network, int prefixBits) {
            this.network = network;
            this.prefixBits = prefixBits;
        }

        static ProxyMatcher parse(String entry) {
            int slash = entry.indexOf('/');
            if (slash < 0) {
                String canonical = canonicalLiteral(entry);
                if (canonical == null) {
                    throw new IllegalArgumentException("Invalid trusted-proxy address: " + entry);
                }
                return new ProxyMatcher(addressBytes(canonical), -1);
            }

            if (entry.indexOf('/', slash + 1) >= 0) {
                throw new IllegalArgumentException("Invalid trusted-proxy CIDR: " + entry);
            }
            String address = canonicalLiteral(entry.substring(0, slash));
            if (address == null) {
                throw new IllegalArgumentException("Invalid trusted-proxy CIDR address: " + entry);
            }
            byte[] bytes = addressBytes(address);
            int prefix;
            try {
                prefix = Integer.parseInt(entry.substring(slash + 1));
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("Invalid trusted-proxy CIDR prefix: " + entry, ex);
            }
            if (prefix < 0 || prefix > bytes.length * 8) {
                throw new IllegalArgumentException("Invalid trusted-proxy CIDR prefix: " + entry);
            }
            int minimumPrefix = bytes.length == 4 ? 24 : 64;
            if (prefix < minimumPrefix || !isPrivateOrLoopback(bytes) || !hasZeroHostBits(bytes, prefix)) {
                throw new IllegalArgumentException("Trusted-proxy CIDR must be narrow, private and network-aligned: " + entry);
            }
            return new ProxyMatcher(bytes, prefix);
        }

        boolean matches(String address) {
            byte[] candidate = addressBytes(address);
            if (candidate.length != network.length) {
                return false;
            }
            if (prefixBits < 0) {
                return Arrays.equals(network, candidate);
            }
            int fullBytes = prefixBits / 8;
            for (int index = 0; index < fullBytes; index++) {
                if (network[index] != candidate[index]) {
                    return false;
                }
            }
            int remainingBits = prefixBits % 8;
            if (remainingBits == 0) {
                return true;
            }
            int mask = 0xFF << (8 - remainingBits);
            return (network[fullBytes] & mask) == (candidate[fullBytes] & mask);
        }

        private static byte[] addressBytes(String canonical) {
            try {
                return InetAddress.getByName(canonical).getAddress();
            } catch (UnknownHostException ex) {
                throw new IllegalArgumentException("Invalid IP literal", ex);
            }
        }

        private static boolean hasZeroHostBits(byte[] bytes, int prefix) {
            int fullBytes = prefix / 8;
            int remainingBits = prefix % 8;
            if (remainingBits > 0 && (bytes[fullBytes] & (0xFF >>> remainingBits)) != 0) {
                return false;
            }
            for (int index = fullBytes + (remainingBits > 0 ? 1 : 0); index < bytes.length; index++) {
                if (bytes[index] != 0) {
                    return false;
                }
            }
            return true;
        }

        private static boolean isPrivateOrLoopback(byte[] bytes) {
            if (bytes.length == 4) {
                int first = Byte.toUnsignedInt(bytes[0]);
                int second = Byte.toUnsignedInt(bytes[1]);
                return first == 10
                        || first == 127
                        || (first == 172 && second >= 16 && second <= 31)
                        || (first == 192 && second == 168)
                        || (first == 169 && second == 254);
            }
            int first = Byte.toUnsignedInt(bytes[0]);
            return first == 0
                    || (first & 0xFE) == 0xFC
                    || (first == 0xFE && (Byte.toUnsignedInt(bytes[1]) & 0xC0) == 0x80);
        }
    }
}
