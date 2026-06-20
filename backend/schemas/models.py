from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import date

class ProductCreate(BaseModel):
    code: str
    name: str
    price: float = 0
    cost_price: float = 0
    stock: int = 0
    min_stock: int = 5
    iva: str = "21%"
    category_id: Optional[int] = None
    is_virtual: bool = False
    parent_id: Optional[int] = None
    pack_size: int = 1
    expiry_date: str = ""

class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    stock: Optional[int] = None
    min_stock: Optional[int] = None
    category_id: Optional[int] = None
    is_virtual: Optional[bool] = None
    parent_id: Optional[int] = None
    pack_size: Optional[int] = None
    expiry_date: Optional[str] = None

class PriceUpdate(BaseModel):
    price: float = Field(gt=0, description="Nuevo precio de venta")
    operator: str = "Sistema"

class StockUpdate(BaseModel):
    stock: int = Field(ge=0, description="Nueva cantidad de stock")
    reason: Optional[str] = None
    operator: str = "Sistema"

class TurnOpen(BaseModel):
    operator: str
    sucursal_id: int = 1
    initial_cash: float = 0

class TurnClose(BaseModel):
    sales_total: float
    counted_cash: float
    notes: Optional[str] = None
    operator_id: Optional[int] = None
    pin: Optional[str] = None

class SaleItem(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(gt=0)
    item_discount: float = 0
    is_virtual: bool = False

class SalePayment(BaseModel):
    method: str
    amount: float = Field(gt=0)

class SaleCreate(BaseModel):
    turn_id: Optional[int] = None
    total: float
    payment: float
    change_given: float = 0
    operator: str = "Sistema"
    is_fiado: bool = False
    fiado_name: Optional[str] = None
    payment_method: str = "efectivo"
    client_cuit: Optional[str] = None
    facturar: bool = False
    tipo_factura: str = 'C'
    vuelto_en_cuenta: bool = False
    cliente_vuelto: Optional[str] = None
    payments: list[SalePayment] = []
    currency: str = 'ARS'
    exchange_rate: float = 1.0
    items: list[SaleItem] = []

class PromotionCondition(BaseModel):
    product_id: int
    min_qty: int = 1

class PromotionCreate(BaseModel):
    name: str
    description: str = ''
    type: str = 'combo'
    conditions: list[PromotionCondition] = []
    discount_percent: float = 0
    combo_price: float = 0
    is_active: bool = True

class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    conditions: Optional[list[PromotionCondition]] = None
    discount_percent: Optional[float] = None
    combo_price: Optional[float] = None
    is_active: Optional[bool] = None
