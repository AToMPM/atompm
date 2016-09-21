import imp

try:
	# if module 'numpy' exists, use it
	found = imp.find_module('numpy')
	nextafter = imp.load_module('numpy', *found).nextafter

except ImportError:
	import math
	# this ad-hoc implementation won't always give the exact same result as the C implementation used by numpy, but it's good enough for our purposes
	def nextafter(x, y):
		m,e = math.frexp(x)
		exp = e - 53
		if exp < -1022 or m == 0.0:
			exp = -1022
		epsilon = math.ldexp(1.0, exp)
		if y > x:
			return x + epsilon
		elif y < x:
			return x - epsilon
		else:
			return x
