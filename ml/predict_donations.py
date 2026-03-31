import sys
import json
import numpy as np
from sklearn.linear_model import LinearRegression

# Read input JSON from Node
input_data = json.loads(sys.stdin.read())

months = np.array(input_data["months"]).reshape(-1, 1)
counts = np.array(input_data["counts"])

# Train simple regression model
model = LinearRegression()
model.fit(months, counts)

# Predict next 3 months
last_month = months[-1][0]
future_months = np.array([
    last_month + 1,
    last_month + 2,
    last_month + 3
]).reshape(-1, 1)

predictions = model.predict(future_months)

# Output JSON back to Node
output = {
    "futureMonths": future_months.flatten().tolist(),
    "predictedCounts": [max(0, int(p)) for p in predictions]
}

print(json.dumps(output))
