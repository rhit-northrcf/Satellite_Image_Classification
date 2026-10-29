import copy
import torch
from tqdm.auto import tqdm


def finetune_model(
    model,
    trainloader,
    validloader,
    costFunction,
    numEpochs=10,
    learning_rate=1e-4,
    encoder_lr=1e-5,
    save_path="best_resnet50.pth",
    device=None
):
    """
    Args:
        model: The model to fine-tune.
        trainloader: DataLoader containing training data.
        validloader: DataLoader containing validation data.
        costFunction: Loss function, such as CrossEntropyLoss().
        numEpochs: Number of training epochs.
        learning_rate: Learning rate for the classification layers.
        encoder_lr: Learning rate for the pretrained ResNet encoder.
        save_path: File path for saving the best model.
        device: Device to train on (CPU or CUDA).

    Returns:
        model: The fine-tuned model.
        history: Dictionary with per-epoch train_loss, valid_loss,
            train_acc, and valid_acc (accuracies are fractions in [0, 1]).
    """

    if device is None:
        device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

    model = model.to(device)

    # Unfreeze the pretrained ResNet encoder.
    for param in model.encoder.parameters():
        param.requires_grad = True

    # Make sure the classification layers are trainable.
    for layer in [model.layer1, model.layer2, model.layer3]:
        for param in layer.parameters():
            param.requires_grad = True

    # Use a smaller learning rate for pretrained weights.
    optimizer = torch.optim.Adam([
        {
            "params": model.encoder.parameters(),
            "lr": encoder_lr
        },
        {
            "params": model.layer1.parameters(),
            "lr": learning_rate
        },
        {
            "params": model.layer2.parameters(),
            "lr": learning_rate
        },
        {
            "params": model.layer3.parameters(),
            "lr": learning_rate
        }
    ])

    best_valid_loss = float("inf")
    best_model_weights = copy.deepcopy(model.state_dict())

    history = {
        "train_loss": [],
        "valid_loss": [],
        "train_acc": [],
        "valid_acc": []
    }

    for epoch in range(numEpochs):


        # Training

        model.train()

        train_loss_total = 0.0
        train_correct = 0
        train_samples = 0

        progress = tqdm(
            trainloader,
            desc=f"Epoch {epoch + 1}/{numEpochs} - Training"
        )

        for images, labels in progress:
            images = images.to(device)
            labels = labels.to(device).long()

            # Forward pass
            outputs = model(images)
            loss = costFunction(outputs, labels)

            # Backpropagation
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            # Accumulate sample-weighted loss
            batch_size = labels.size(0)
            train_loss_total += loss.item() * batch_size
            train_correct += (outputs.argmax(dim=1) == labels).sum().item()
            train_samples += batch_size

            progress.set_postfix(loss=loss.item())

        avg_train_loss = train_loss_total / train_samples
        avg_train_acc = train_correct / train_samples

        # Validation

        model.eval()

        valid_loss_total = 0.0
        valid_correct = 0
        valid_samples = 0

        with torch.no_grad():
            for images, labels in tqdm(
                validloader,
                desc=f"Epoch {epoch + 1}/{numEpochs} - Validation"
            ):
                images = images.to(device)
                labels = labels.to(device).long()

                outputs = model(images)
                loss = costFunction(outputs, labels)

                batch_size = labels.size(0)
                valid_loss_total += loss.item() * batch_size
                valid_correct += (outputs.argmax(dim=1) == labels).sum().item()
                valid_samples += batch_size

        avg_valid_loss = valid_loss_total / valid_samples
        avg_valid_acc = valid_correct / valid_samples

        history["train_loss"].append(avg_train_loss)
        history["valid_loss"].append(avg_valid_loss)
        history["train_acc"].append(avg_train_acc)
        history["valid_acc"].append(avg_valid_acc)

        print(
            f"Epoch {epoch + 1}/{numEpochs} | "
            f"Train Loss: {avg_train_loss:.4f} | "
            f"Train Acc: {avg_train_acc * 100:.2f}% | "
            f"Validation Loss: {avg_valid_loss:.4f} | "
            f"Validation Acc: {avg_valid_acc * 100:.2f}%"
        )

        # Save the model whenever validation loss improves.
        if avg_valid_loss < best_valid_loss:
            best_valid_loss = avg_valid_loss
            best_model_weights = copy.deepcopy(model.state_dict())

            torch.save(best_model_weights, save_path)

            print(f"Best model saved to {save_path}")

    # Restore the best-performing weights.
    model.load_state_dict(best_model_weights)

    return model, history