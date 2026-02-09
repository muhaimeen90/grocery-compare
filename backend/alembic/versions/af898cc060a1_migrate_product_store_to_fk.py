"""migrate_product_store_to_fk

Revision ID: af898cc060a1
Revises: b8c21cb5ea58
Create Date: 2026-02-06 04:56:40.010062

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af898cc060a1'
down_revision: Union[str, None] = 'b8c21cb5ea58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Populate store_id from store string values
    # Map store names to IDs (these should match the populated stores table)
    op.execute("""
        UPDATE products 
        SET store_id = stores.id 
        FROM stores 
        WHERE LOWER(products.store) = LOWER(stores.name)
    """)
    
    # Step 2: Make store_id NOT NULL
    op.alter_column('products', 'store_id', nullable=False)
    
    # Step 3: Drop old composite indexes that use the store string column
    op.drop_index('idx_store_category', table_name='products')
    op.drop_index('idx_store_brand', table_name='products')
    
    # Step 4: Create new composite indexes using store_id
    op.create_index('idx_store_id_category', 'products', ['store_id', 'category'])
    op.create_index('idx_store_id_brand', 'products', ['store_id', 'brand'])
    
    # Step 5: Drop the old store string column
    op.drop_column('products', 'store')


def downgrade() -> None:
    # Reverse the migration
    # Step 1: Re-add the store string column
    op.add_column('products', sa.Column('store', sa.String(), nullable=True))
    
    # Step 2: Populate store from store_id
    op.execute("""
        UPDATE products 
        SET store = stores.name 
        FROM stores 
        WHERE products.store_id = stores.id
    """)
    
    # Step 3: Make store NOT NULL
    op.alter_column('products', 'store', nullable=False)
    
    # Step 4: Drop new indexes
    op.drop_index('idx_store_id_brand', table_name='products')
    op.drop_index('idx_store_id_category', table_name='products')
    
    # Step 5: Recreate old indexes
    op.create_index('idx_store_brand', 'products', ['store', 'brand'])
    op.create_index('idx_store_category', 'products', ['store', 'category'])
    
    # Step 6: Make store_id nullable again (don't drop it, keep for backward compat)
    op.alter_column('products', 'store_id', nullable=True)
