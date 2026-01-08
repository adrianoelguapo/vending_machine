let currentCode = "";
let currentCredit = 0;


async function updateCredit() {

    try {

        currentCredit = await window.api.getCredit();
        $('#credit-display').text(`CREDIT: ${currentCredit.toFixed(2)}€`);

    } catch (err) {

        console.error("Error updating credit:", err);

    }

}

function showMessage(message, duration = 3000) {

    const messagesDiv = $('#screen-messages');
    messagesDiv.html(message.replace(/\n/g, '<br>'));
    
    if (duration > 0) {

        setTimeout(() => {

            messagesDiv.html('');

        }, duration);

    }

}

function clearCurrentCode() {

    currentCode = "";

}


async function loadProductGrid() {

    try {


        const products = await window.api.fetchProducts();
        

        const productGrid = $('.product-grid');
        productGrid.empty();


        const totalSlots = 15;
        

        const timestamp = new Date().getTime();
        
        for (let i = 0; i < totalSlots; i++) {

            if (i < products.length) {

                const product = products[i];
                const slotHtml = `
                <div class = "product-slot">

                    <div class = "product-slot-img-container">

                        <img src = "../images/products/${product.image}?t=${timestamp}" class = "product-slot-img" alt = "${product.name}">

                    </div>

                    <p class = "product-slot-code d-flex justify-content-center align-items-center text-white">${product.code}</p>

                </div>`;
                productGrid.append(slotHtml);

            } else {

                const slotHtml = `<div class = "product-slot"></div>`;
                productGrid.append(slotHtml);

            }

        }

    } catch (err) {

        console.error("Error loading products:", err);

    }

}


$(document).ready(async function() {

    try {


        await loadProductGrid();


        await updateCredit();

    } catch (err) {

        console.error("Error loading products:", err);

    }


    $('.key').on('click', async function() {

        const keyValue = $(this).text().trim();
        

        if (keyValue === 'X') {

            if (currentCredit > 0) {


                const modal = new bootstrap.Modal(document.getElementById('return-money-modal'));
                modal.show();

            } else {


                clearCurrentCode();
                showMessage('Code cleared', 1000);

            }

            return;

        }
        

        if ($(this).find('img').length > 0) {

            const modal = new bootstrap.Modal(document.getElementById('open-machine-modal'));
            modal.show();
            return;

        }
        

        if (keyValue >= '0' && keyValue <= '9') {

            currentCode += keyValue;
            showMessage(`Code: ${currentCode}`, 0);
            

            if (currentCode.length === 2) {


                setTimeout(async () => {

                    try {

                        const result = await window.api.purchaseProduct(currentCode);
                        
                        if (result.success) {

                            showMessage(result.message, 4000);
                            currentCredit = result.credit;
                            $('#credit-display').text(`CREDIT: ${currentCredit.toFixed(2)}€`);

                        } else {

                            const duration = result.showInfo ? 3000 : 4000;
                            showMessage(result.message, duration);

                        }
                        
                        clearCurrentCode();

                    } catch (err) {

                        console.error("Purchase error:", err);
                        showMessage('ERROR', 2000);
                        clearCurrentCode();

                    }

                }, 500);

            }

        }

    });


    $(document).on('click', '.insert-money-btn', async function() {

        const denominationId = parseInt($(this).data('denomination-id'));
        
        try {

            const newCredit = await window.api.insertMoney(denominationId);
            
            if (newCredit !== null) {

                currentCredit = newCredit;
                $('#credit-display').text(`CREDIT: ${currentCredit.toFixed(2)}€`);
                

                $(this).addClass('btn-success');
                setTimeout(() => {

                    $(this).removeClass('btn-success');

                }, 200);

            } else {

                console.error("Failed to insert money");

            }

        } catch (err) {

            console.error("Error inserting money:", err);

        }

    });


    $('#confirm-return-money').on('click', async function() {

        try {

            const result = await window.api.returnMoney();
            
            if (result.success) {

                await updateCredit();
                showMessage('Money returned', 2000);

            } else {

                showMessage('Failed to return money', 2000);

            }

        } catch (err) {

            console.error("Error returning money:", err);
            showMessage('ERROR', 2000);

        }

    });


    document.getElementById('restock-product-modal').addEventListener('shown.bs.modal', async function() {

        await loadRestockProducts();

    });

    document.getElementById('change-price-modal').addEventListener('shown.bs.modal', async function() {

        await loadChangePriceProducts();

    });

    document.getElementById('withdraw-money-modal').addEventListener('shown.bs.modal', async function() {

        await loadWithdrawMoney();

    });

    document.getElementById('change-product-modal').addEventListener('shown.bs.modal', async function() {

        await loadChangeProductList();

    });

    async function loadRestockProducts() {

        try {

            const products = await window.api.fetchProducts();
            const container = $('#restock-products-container');
            container.empty();

            products.forEach(product => {

                const quantityClass = product.quantity === 0 ? 'text-danger' : 'text-white';
                
                const productCard = $(`
                    <div class = "col-md-6 col-lg-4">

                        <div class = "product-restock-card">

                            <img src = "../images/products/${product.image}" class = "restock-product-img" alt = "${product.name}">
                            <h6 class = "restock-product-name">${product.name}</h6>
                            <p class = "restock-product-code">Code: ${product.code}</p>
                            <p class = "restock-product-quantity ${quantityClass}">Current stock: ${product.quantity}</p>

                            <div class = "restock-controls">

                                <label class = "restock-label">Amount to restock:</label>
                                <input type = "number" class = "restock-quantity-input" min = "1" value = "1" data-product-code = "${product.code}">

                                <button class = "btn machine-button text-white restock-btn" data-product-code = "${product.code}">Restock</button>

                            </div>

                        </div>

                    </div>
                `);

                container.append(productCard);

            });


            $('.restock-btn').on('click', async function() {


                const productCode = $(this).attr('data-product-code');
                const input = $(`.restock-quantity-input[data-product-code="${productCode}"]`);
                const quantity = parseInt(input.val());

                if (quantity && quantity > 0) {

                    const result = await window.api.restockProduct(productCode, quantity);
                    
                    if (result.success) {

                        await loadRestockProducts();
                        await loadProductGrid();

                    } else {

                        console.error("Restock failed:", result.message);

                    }

                }

            });

        } catch (error) {

            console.error("Error loading products for restock:", error);

        }

    }

    async function loadChangePriceProducts() {

        try {

            const products = await window.api.fetchProducts();
            const container = $('#change-price-products-container');
            container.empty();

            products.forEach(product => {

                const productCard = $(`
                    <div class = "col-md-6 col-lg-4">
                    
                        <div class = "product-restock-card">

                            <img src = "../images/products/${product.image}" class = "restock-product-img" alt = "${product.name}">
                            <h6 class = "restock-product-name">${product.name}</h6>
                            <p class = "restock-product-code">Code: ${product.code}</p>
                            <p class = "restock-product-quantity text-white">Current price: €${product.price.toFixed(2)}</p>

                            <div class = "restock-controls">

                                <label class = "restock-label">New price (€):</label>
                                <input type = "number" class = "restock-quantity-input price-input" min = "0.01" step = "0.01" value = "${product.price.toFixed(2)}" data-product-code = "${product.code}">

                                <button class = "btn machine-button text-white change-price-btn" data-product-code = "${product.code}">Change Price</button>

                            </div>

                        </div>

                    </div>
                `);

                container.append(productCard);

            });


            $('.change-price-btn').on('click', async function() {


                const productCode = $(this).attr('data-product-code');
                const input = $(`.price-input[data-product-code="${productCode}"]`);
                const newPrice = parseFloat(input.val());

                if (newPrice && newPrice > 0) {

                    const result = await window.api.changeProductPrice(productCode, newPrice);
                    
                    if (result.success) {

                        await loadChangePriceProducts();
                        await loadProductGrid();

                    } else {

                        console.error("Price change failed:", result.message);

                    }

                }

            });

        } catch (error) {

            console.error("Error loading products for price change:", error);

        }

    }

    async function loadWithdrawMoney() {

        try {

            const money = await window.api.fetchMoney();
            const container = $('#withdraw-money-container');
            container.empty();


            const VALUES = {
                1: 0.10,
                2: 0.20,
                3: 0.50,
                4: 1.00,
                5: 2.00,
                6: 5.00,
                7: 10.00,
                8: 20.00
            };


            let totalMoney = 0;
            money.forEach(denomination => {

                const value = VALUES[denomination.id] || 0;
                totalMoney += value * denomination.quantity;

            });


            const totalDisplay = $(`
                <div class = "col-12 mb-3">

                    <div class = "total-money-display">

                        <h4 class = "text-white mb-3">Total Money in Machine: €${totalMoney.toFixed(2)}</h4>
                        <button class = "btn machine-button text-white withdraw-all-btn" id = "withdraw-all-btn">

                            <span style = "font-size: 1.2rem;">Withdraw All Money</span>

                        </button>

                    </div>

                </div>
            `);
            container.append(totalDisplay);


            money.forEach(denomination => {

                const value = VALUES[denomination.id] || 0;
                const totalValue = (value * denomination.quantity).toFixed(2);
                const quantityClass = denomination.quantity === 0 ? 'text-danger' : 'text-white';
                
                const moneyCard = $(`
                    <div class = "col-md-6 col-lg-4">

                        <div class = "product-restock-card">
                        
                            <img src = "${denomination.image}" class = "restock-product-img" alt = "${denomination.name}">
                            <h6 class = "restock-product-name">${denomination.name}</h6>
                            <p class = "restock-product-code">Value: €${value.toFixed(2)}</p>
                            <p class = "restock-product-quantity ${quantityClass}">Quantity: ${denomination.quantity}</p>
                            <p class = "restock-product-quantity text-white">Total: €${totalValue}</p>

                            <div class = "restock-controls">

                                <button class = "btn machine-button text-white withdraw-denomination-btn" data-denomination-id = "${denomination.id}" ${denomination.quantity === 0 ? 'disabled' : ''}>Withdraw</button>

                            </div>

                        </div>

                    </div>
                `);

                container.append(moneyCard);

            });


            $('#withdraw-all-btn').on('click', async function() {

                const result = await window.api.withdrawAllMoney();
                
                if (result.success) {


                    await loadWithdrawMoney();

                } else {

                    console.error("Withdraw all failed:", result.message);

                }

            });


            $('.withdraw-denomination-btn').on('click', async function() {

                const denominationId = parseInt($(this).attr('data-denomination-id'));
                const result = await window.api.withdrawMoneyDenomination(denominationId);
                
                if (result.success) {


                    await loadWithdrawMoney();

                } else {

                    console.error("Withdraw denomination failed:", result.message);

                }

            });

        } catch (error) {

            console.error("Error loading money for withdrawal:", error);

        }

    }

    async function loadChangeProductList() {

        try {

            const products = await window.api.fetchProducts();
            const container = $('#change-product-list-container');
            container.empty();


            const timestamp = new Date().getTime();

            products.forEach(product => {

                const productCard = $(`
                    <div class = "col-md-6 col-lg-4">

                        <div class = "product-restock-card">
                        
                            <img src = "../images/products/${product.image}?t=${timestamp}" class = "restock-product-img" alt = "${product.name}">
                            <h6 class = "restock-product-name">${product.name}</h6>
                            <p class = "restock-product-code">Code: ${product.code}</p>
                            <p class = "restock-product-quantity text-white">Price: €${product.price.toFixed(2)}</p>

                            <div class = "restock-controls">

                                <button class = "btn machine-button text-white open-change-form-btn" data-product-code = "${product.code}" data-product-name = "${product.name}" data-product-price = "${product.price}">Change Product</button>

                            </div>

                        </div>

                    </div>
                `);

                container.append(productCard);

            });


            $('.open-change-form-btn').on('click', function() {

                const productCode = $(this).attr('data-product-code');
                const productName = $(this).attr('data-product-name');
                const productPrice = $(this).attr('data-product-price');
                
                openChangeProductForm(productCode, productName, productPrice);

            });

        } catch (error) {

            console.error("Error loading products for change:", error);

        }

    }

    function openChangeProductForm(productCode, currentName, currentPrice) {


        bootstrap.Modal.getInstance(document.getElementById('change-product-modal')).hide();
        

        $('#change-product-code-display').text(productCode);
        $('#change-product-name-input').val(currentName);
        $('#change-product-price-input').val(currentPrice);
        $('#change-product-image-input').val('');
        $('#image-preview').hide();
        

        $('#change-product-form').data('product-code', productCode);
        

        setTimeout(() => {

            const formModal = new bootstrap.Modal(document.getElementById('change-product-form-modal'));
            formModal.show();

        }, 200);

    }


    $('#change-product-image-input').on('change', function(e) {

        const file = e.target.files[0];

        if (file) {


            if (!file.type.match('image/png')) {

                alert('Only PNG images are accepted!');
                $(this).val('');
                $('#image-preview').hide();
                return;

            }
            

            const reader = new FileReader();
            reader.onload = function(event) {

                $('#image-preview').attr('src', event.target.result).show();

            };
            reader.readAsDataURL(file);

        }

    });


    $('#submit-change-product').on('click', async function() {

        const productCode = $('#change-product-form').data('product-code');
        const newName = $('#change-product-name-input').val().trim();
        const newPrice = parseFloat($('#change-product-price-input').val());
        const imageFile = $('#change-product-image-input')[0].files[0];
        

        if (!newName) {

            alert('Product name is required!');
            return;

        }
        
        if (isNaN(newPrice) || newPrice <= 0) {

            alert('Please enter a valid price!');
            return;

        }
        

        let imageData = null;

        if (imageFile) {

            const reader = new FileReader();
            reader.onload = async function(event) {

                imageData = event.target.result;
                

                const result = await window.api.changeProduct(productCode, newName, newPrice, imageData);
                
                if (result.success) {


                    bootstrap.Modal.getInstance(document.getElementById('change-product-form-modal')).hide();
                    

                    await loadProductGrid();
                    

                    setTimeout(async () => {

                        const listModal = new bootstrap.Modal(document.getElementById('change-product-modal'));
                        listModal.show();
                        await loadChangeProductList();

                    }, 300);

                } else {

                    console.error('Change product failed:', result.message);
                    alert('Failed to change product: ' + result.message);

                }

            };
            reader.readAsDataURL(imageFile);

        } else {


            const result = await window.api.changeProduct(productCode, newName, newPrice, null);
            
            if (result.success) {


                bootstrap.Modal.getInstance(document.getElementById('change-product-form-modal')).hide();
                

                await loadProductGrid();
                

                setTimeout(async () => {

                    const listModal = new bootstrap.Modal(document.getElementById('change-product-modal'));
                    listModal.show();
                    await loadChangeProductList();

                }, 300);

            } else {

                console.error('Change product failed:', result.message);
                alert('Failed to change product: ' + result.message);

            }

        }

    });


    $('#back-to-product-list').on('click', function() {

        bootstrap.Modal.getInstance(document.getElementById('change-product-form-modal')).hide();
        setTimeout(() => {

            const listModal = new bootstrap.Modal(document.getElementById('change-product-modal'));
            listModal.show();

        }, 200);

    });

});