import random

class utils:

	@staticmethod
	def random():
		return random.random()


	"""
		provide "." access to dictionaries

		example: d = {'a':1}
			before: d['a'] => 1, d.a => error
			after:  d['a'] = d.a
	"""
	class _bunch:
		def __init__(self, **kwds):
			self.__dict__.update(kwds)
