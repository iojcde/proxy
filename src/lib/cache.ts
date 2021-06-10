import bytes from 'bytes'
import LRU from 'lru-cache'
const options = {
  max: bytes('128mB'),
  length: function (n, key) {
    return n * 2 + key.length
  },
  dispose: function (key, n) {
    n.close()
  },
  maxAge: 1000 * 60 * 60,
}
const cache = new LRU(options)

export default cache
