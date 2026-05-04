from winnowing import winnowing_similarity

t1 = ["def", "hitung", "a", "b", "return", "a", "b"]
t2 = ["def", "jumlah", "x", "y", "return", "x", "y"]

print("Token 1:", t1)
print("Token 2:", t2)
print("Jumlah token 1:", len(t1))
score = winnowing_similarity(t1, t2)
print("Winnowing score:", score)
