from winnowing import winnowing_similarity

code1 = """
def hitung(a, b):
	return a + b
"""

code2 = """
def jumlah(x, y):
	return x + y
"""

print("Code 1:")
print(code1)
print("Code 2:")
print(code2)
score = winnowing_similarity(code1, code2)
print("Winnowing score:", score)
