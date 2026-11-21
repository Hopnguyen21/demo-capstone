using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Persistence.Configurations;

internal sealed class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> b)
    {
        b.ToTable("PaymentTransactions");
        b.HasKey(x => x.Id);
        b.Property(x => x.OrderCode).IsRequired();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.Status).HasMaxLength(50).IsRequired();
        b.Property(x => x.PaymentLinkId).HasMaxLength(200);
        b.Property(x => x.CheckoutUrl).HasMaxLength(1000);
        b.Property(x => x.QrCode).HasMaxLength(2000);
        b.Property(x => x.BankAccountNumber).HasMaxLength(100);
        b.Property(x => x.BankAccountName).HasMaxLength(200);
        b.Property(x => x.BankBin).HasMaxLength(50);
        b.Property(x => x.BankName).HasMaxLength(100);
        b.Property(x => x.Reference).HasMaxLength(200);

        b.HasOne(x => x.Bill)
            .WithMany(x => x.PaymentTransactions)
            .HasForeignKey(x => x.BillId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => x.OrderCode).IsUnique();
        b.HasIndex(x => x.BillId);
        b.HasIndex(x => x.Status);
    }
}
