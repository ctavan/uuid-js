/** 
 UUID-js : A js library to generate and parse UUIDs,TimeUUIDs and generate TimeUUID based on Data for range selections
 http://www.ietf.org/rfc/rfc4122.txt
 **/

UUID = function() { }

UUID.maxFromBits = function( bits )
{
  return Math.pow(2,bits);
}

UUID.limitUI04 = UUID.maxFromBits( 4 );
UUID.limitUI06 = UUID.maxFromBits( 6 );
UUID.limitUI08 = UUID.maxFromBits( 8 );
UUID.limitUI12 = UUID.maxFromBits( 12 );
UUID.limitUI14 = UUID.maxFromBits( 14 );
UUID.limitUI16 = UUID.maxFromBits( 16 );
UUID.limitUI32 = UUID.maxFromBits( 32 );

UUID.randomUI04 = function() { return Math.round(Math.random() * UUID.limitUI04); }
UUID.randomUI06 = function() { return Math.round(Math.random() * UUID.limitUI06); }
UUID.randomUI08 = function() { return Math.round(Math.random() * UUID.limitUI08); }
UUID.randomUI12 = function() { return Math.round(Math.random() * UUID.limitUI12); }
UUID.randomUI14 = function() { return Math.round(Math.random() * UUID.limitUI14); }
UUID.randomUI16 = function() { return Math.round(Math.random() * UUID.limitUI16); }
UUID.randomUI32 = function() { return Math.round(Math.random() * UUID.limitUI32); }
UUID.randomUI40 = function() { return (0 | Math.random() * (1 << 30)) + (0 | Math.random() * (1 << 40 - 30)) * (1 << 30); }
UUID.randomUI48 = function() { return (0 | Math.random() * (1 << 30)) + (0 | Math.random() * (1 << 48 - 30)) * (1 << 30); }

UUID.paddedString = function( string, length, z )
{
  string = new String(string);
  z = (!z)?"0":z;
  var i = length - string.length;
  for (; i > 0; i >>>= 1, z += z) { if (i & 1) { string = z + string; } } 
  return string;
}

UUID.prototype.fromParts = function( timeLow, timeMid, timeHiAndVersion, clockSeqHiAndReserved, clockSeqLow, node )
{
  this.version = (timeHiAndVersion >> 12) & 0xF;
  this.hex = UUID.paddedString( timeLow.toString(16), 8 )
             + '-'
             + UUID.paddedString( timeMid.toString(16), 4 )
             + '-'
             + UUID.paddedString( timeHiAndVersion.toString(16), 4 )
             + '-'
             + UUID.paddedString( clockSeqHiAndReserved.toString(16), 2 )
             + UUID.paddedString( clockSeqLow.toString(16), 2 )
             + '-'
             + UUID.paddedString( node.toString(16), 12 );
  return this;
}

UUID.prototype.toString = function() { return this.hex; };
UUID.prototype.toURN = function() { return 'urn:uuid:' + this.hex; };

UUID.prototype.toBytes = function()
{
  var parts = this.hex.split('-');
  var ints = [];
  var intPos = 0;
  for (var i = 0; i < parts.length; i++) {
    for (var j = 0; j < parts[i].length; j+=2) {
      ints[intPos++] = parseInt(parts[i].substr(j, 2), 16);
    }
  }
  return ints;
}

UUID.prototype.equals = function(uuid)
{
  if (!(uuid instanceof UUID)) { return false; }
  if (this.hex !== uuid.hex) return false;
  return true;
};

UUID.new = function()
{
  return new UUID().fromParts(
    UUID.randomUI32(),
    UUID.randomUI16(),
    0x4000 | UUID.randomUI12(),
    0x80   | UUID.randomUI06(),
    UUID.randomUI08(),
    UUID.randomUI48()
  );
}

UUID.getTimeFieldValues = function(time)
{
  var ts = time - Date.UTC(1582, 9, 15);
  var hm = ((ts / 0x100000000) * 10000) & 0xFFFFFFF;
  return { low: ((ts & 0xFFFFFFF) * 10000) % 0x100000000,
            mid: hm & 0xFFFF, hi: hm >>> 16, timestamp: ts };
}

UUID.newTS = function()
{
  var now = new Date().getTime();
  var sequence = UUID.randomUI14();
  var node = (UUID.randomUI08() | 1) * 0x10000000000 + UUID.randomUI40();
  var tick = UUID.randomUI04();
  var timestamp = 0;
  var timestampRatio = 1/4;

  if (now != timestamp)
  {
    if (now < timestamp) { sequence++; }
    timestamp = now;
    tick = UUID.randomUI04();
  } else if (Math.random() < timestampRatio && tick < 9984) { tick += 1 + UUID.randomUI04();
  } else { sequence++; }

  var tf = UUID.getTimeFieldValues(timestamp);
  var tl = tf.low + tick;
  var thav = (tf.hi & 0xFFF) | 0x1000;

  sequence &= 0x3FFF;
  var cshar = (sequence >>> 8) | 0x80;
  var csl = sequence & 0xFF;
  
  return new UUID().fromParts(tl, tf.mid, thav, cshar, csl, node);
}

UUID.fromTime = function( time, last )
{
  last = (!last)?false:last;
  var tf = UUID.getTimeFieldValues( time );
  var tl = tf.low;
  var thav = (tf.hi & 0xFFF) | 0x1000;  // set version '0001'
  if (last == false) return new UUID().fromParts(tl,tf.mid,thav, 0, 0, 0);
  else return new UUID().fromParts(tl,tf.mid,thav, 0x80 | UUID.limitUI06, UUID.limitUI08, UUID.limitUI48 );
}

UUID.firstUUIDForTime = function(time) { return UUID.fromTime(time, false); }
UUID.lastUUIDForTime = function(time) { return UUID.fromTime(time, true); }

UUID.fromURN = function(strId)
{
  var r, p = /^(?:urn:uuid:|\{)?([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{12})(?:\})?$/i;
  if (r = p.exec(strId)) {
    return new UUID().fromParts(parseInt(r[1], 16), parseInt(r[2], 16),
                            parseInt(r[3], 16), parseInt(r[4], 16),
                            parseInt(r[5], 16), parseInt(r[6], 16));
  }
  return null;
};

UUID.fromBytes = function(ints)
{
  if (ints.length < 5) return null;
  var str = '';
  var pos = 0;
  var parts = [4, 2, 2, 2, 6];
  for (var i = 0; i < parts.length; i++) {
    for (var j = 0; j < parts[i]; j++) {
      var octet = ints[pos++].toString(16);
      if (octet.length == 1) {
        octet = '0' + octet;
      }
      str += octet;
    }
    if (parts[i] !== 6) {
      str += '-';
    }
  }
  return UUID.fromURN( str );
}

UUID.fromBinary = function(binary)
{
  var ints = [];
  for (var i = 0; i < binary.length; i++) {
    ints[i] = binary.charCodeAt(i);
    if (ints[i] > 255 || ints[i] < 0) {
      throw new Error('Unexpected byte in binary data.');
    }
  }
  return UUID.fromBytes( ints );
}

module.exports = UUID;
