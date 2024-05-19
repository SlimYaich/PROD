
fetch('https://test.almithali.com.sa/sales_api_test')
        .then(response => response.json())
        .then(data => {
            const currentSales = data.currentSales;
            const previousSales = data.previousSales;
            const salesGrowthPercentage = ((currentSales - previousSales) / previousSales) * 100;
            
            // Display the sales growth percentage on the card
            document.getElementById('salesGrowthPercentage').innerText = `Sales Growth Percentage: ${salesGrowthPercentage.toFixed(2)}%`;
        })
        .catch(error => console.error('Error fetching data:', error));